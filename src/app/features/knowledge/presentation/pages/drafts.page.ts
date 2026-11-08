import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { Draft } from '../../domain/entities/knowledge';
import { ValidateReference, ValidateRule } from '../../domain/usecases/knowledge-usecases';
import { DraftsState } from '../drafts.state';

type Kind = Draft['kind'];

const KIND_LABELS: Readonly<Record<Kind, string>> = { reference: 'Referencia', rule: 'Regla' };

const CONFLICT_MESSAGES: Readonly<Record<Kind, string>> = {
  reference: 'No es un borrador, o se solapa con una referencia ya validada.',
  rule: 'La regla no es un borrador (quizá ya fue validada).',
};

/** Container: validates drafts created in this session, or any draft by its id. */
@Component({
  selector: 'app-drafts-page',
  imports: [FormsModule, BannerComponent, ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (!canValidate) {
        <app-banner tone="warning">
          Solo los médicos pueden validar borradores. Aquí puedes ver los que creaste en esta
          sesión.
        </app-banner>
      }
      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }
      @if (error(); as e) {
        <app-banner tone="danger">
          {{ e.message }}
          @if (e.supportCode) {
            <span class="small">Código de soporte: {{ e.supportCode }}</span>
          }
        </app-banner>
      }

      <section class="card stack">
        <div>
          <h2>Borradores de esta sesión</h2>
          <p class="muted small">
            El sistema no lista borradores: solo ves los que creaste desde este navegador desde que
            iniciaste sesión.
          </p>
        </div>
        @if (drafts.drafts().length === 0) {
          <p class="empty">Todavía no creaste borradores.</p>
        } @else {
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
                @for (draft of drafts.drafts(); track draft.id) {
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
        }
      </section>

      @if (canValidate) {
        <section class="card stack">
          <div>
            <h2>Validar por ID</h2>
            <p class="muted small">Para borradores que creó otra persona u otra sesión.</p>
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
  private readonly validateReference = inject(ValidateReference);
  private readonly validateRule = inject(ValidateRule);

  protected readonly drafts = inject(DraftsState);
  protected readonly canValidate = inject(SessionState).can(PERMISSIONS.knowledgeValidate);
  protected readonly busyId = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  protected manualKind: Kind = 'reference';
  protected manualId = '';

  protected readonly kindLabel = (kind: Kind) => KIND_LABELS[kind];

  protected async validate(kind: Kind, id: string, manual = false): Promise<void> {
    this.busyId.set(manual ? 'manual' : id);
    this.notice.set(null);
    this.error.set(null);
    try {
      if (kind === 'reference') await this.validateReference.execute(id);
      else await this.validateRule.execute(id);
      this.drafts.markValidated(id.trim());
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
