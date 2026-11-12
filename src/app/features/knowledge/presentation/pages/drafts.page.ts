import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { Draft } from '../../domain/entities/knowledge';
import { ListDrafts, ValidateReference, ValidateRule } from '../../domain/usecases/knowledge-usecases';
import { DraftsState } from '../drafts.state';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { PageState } from '../../../../shared/presentation/pagination';

type Kind = Draft['kind'];

const KIND_LABELS: Readonly<Record<Kind, string>> = { reference: 'Referencia', rule: 'Regla' };

const CONFLICT_MESSAGES: Readonly<Record<Kind, string>> = {
  reference: 'No es un borrador, o se solapa con una referencia ya validada.',
  rule: 'La regla no es un borrador (quizá ya fue validada).',
};

/** Container: lists the drafts for whoever validates or administers, and validates them. */
@Component({
  selector: 'app-drafts-page',
  imports: [FormsModule, BannerComponent, ChipComponent, PaginatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (!canValidate) {
        <app-banner tone="warning">
          Solo los médicos pueden validar borradores. Aquí ves los que creaste en esta sesión
          @if (canList) {
            y los demás borradores
          }
          .
        </app-banner>
      }
      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }
      @if (error(); as e) {
        <app-banner tone="danger">
          {{ e.message }}
        </app-banner>
      }

      <section class="card stack">
        <div>
          <h2>Borradores</h2>
          <p class="muted small">
            @if (canList) {
              Las referencias y reglas que esperan validación médica.
            } @else {
              Tu rol no ve el listado completo: solo los borradores que creaste en esta sesión.
            }
          </p>
        </div>
        @if (loading()) {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
        } @else if (loadFailed()) {
          <app-banner tone="danger">No pudimos cargar los borradores.</app-banner>
          <div><button class="btn btn--small" type="button" (click)="load()">Reintentar</button></div>
        }
        @if (!loading() && items().length === 0) {
          <p class="empty">No hay borradores.</p>
        } @else if (items().length > 0) {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>ID</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (draft of pager.slice(items()); track draft.id) {
                  <tr>
                    <td>{{ kindLabel(draft.kind) }}</td>
                    <td>{{ draft.label }}</td>
                    <td class="mono">{{ draft.id }}</td>
                    <td>
                      <app-chip [tone]="draft.state === 'VALIDADA' ? 'success' : 'warning'">
                        {{ draft.state === 'VALIDADA' ? 'Validada' : 'Borrador' }}
                      </app-chip>
                    </td>
                    <td>
                      @if (canValidate && draft.state === 'BORRADOR') {
                        <button
                          class="btn btn--small btn--primary"
                          type="button"
                          [disabled]="busyId() === draft.id"
                          (click)="validate(draft.kind, draft.id)"
                        >
                          {{ busyId() === draft.id ? 'Validando…' : 'Validar' }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
      <app-paginator [total]="items().length" [state]="pager" />
        }
      </section>

      @if (canValidate) {
        <section class="card stack">
          <div>
            <h2>Validar por ID</h2>
            <p class="muted small">Si ya tienes el identificador de un borrador.</p>
          </div>
          <div class="row">
            <select class="input kind" [(ngModel)]="manualKind" aria-label="Tipo de borrador">
              <option value="reference">Referencia</option>
              <option value="rule">Regla</option>
            </select>
            <input
              class="input mono id"
              [(ngModel)]="manualId"
              placeholder="UUID del borrador"
              aria-label="ID del borrador"
            />
            <button
              class="btn btn--primary"
              type="button"
              [disabled]="busyId() === 'manual' || !manualId.trim()"
              (click)="validate(manualKind, manualId, true)"
            >
              Validar
            </button>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .kind {
      width: 160px;
    }
    .id {
      flex: 1 1 320px;
    }
  `,
})
export class DraftsPage {
  protected readonly pager = new PageState();
  private readonly validateReference = inject(ValidateReference);
  private readonly validateRule = inject(ValidateRule);
  private readonly listDrafts = inject(ListDrafts);

  protected readonly drafts = inject(DraftsState);
  private readonly session = inject(SessionState);
  protected readonly canValidate = this.session.can(PERMISSIONS.knowledgeValidate);
  /** Only who validates or administers may list drafts; the rest see what they created this session. */
  protected readonly canList =
    this.canValidate || this.session.can(PERMISSIONS.knowledgeAdmin);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  private readonly listed = signal<readonly Draft[]>([]);
  /** The listing wins; drafts created in this session fill in until it knows them. */
  protected readonly items = computed(() => {
    const ids = new Set(this.listed().map((d) => d.id));
    return [...this.listed(), ...this.drafts.drafts().filter((d) => !ids.has(d.id))];
  });
  protected readonly busyId = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  protected manualKind: Kind = 'reference';
  protected manualId = '';

  protected readonly kindLabel = (kind: Kind) => KIND_LABELS[kind];

  constructor() {
    if (this.canList) void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      this.listed.set(await this.listDrafts.execute());
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async validate(kind: Kind, id: string, manual = false): Promise<void> {
    this.busyId.set(manual ? 'manual' : id);
    this.notice.set(null);
    this.error.set(null);
    try {
      if (kind === 'reference') await this.validateReference.execute(id);
      else await this.validateRule.execute(id);
      this.drafts.markValidated(id.trim());
      this.listed.update((list) => list.map((d) => (d.id === id.trim() ? { ...d, state: 'VALIDADA' as const } : d)));
      this.notice.set(`${KIND_LABELS[kind]} validada: ya puede usarse.`);
      if (manual) this.manualId = '';
    } catch (error) {
      this.error.set(
        describeError(error, {
          conflict: CONFLICT_MESSAGES[kind],
          not_found: `No se encontró ${kind === 'rule' ? 'la regla' : 'la referencia'}.`,
          validation: 'El ID debe ser un UUID válido.',
        }),
      );
    } finally {
      this.busyId.set(null);
    }
  }
}
