import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { ErrorKind } from '../../../../core/domain/app-error';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { formatDate } from '../../../../shared/presentation/format';
import { ModalComponent } from '../../../../shared/presentation/organisms/modal';
import {
  EditableFinding,
  NewShadowEdit,
  ShadowEdit,
  ShadowReport,
  ShadowSnapshot,
  ShadowSnapshotItem,
} from '../../domain/entities/shadow';
import {
  EditShadowFinding,
  GetShadowReport,
  ListShadowEdits,
  RecordShadowSnapshot,
} from '../../domain/usecases/shadow-usecases';
import {
  SHADOW_ACTION_PAST,
  categoryLabel,
  findingLabel,
  roleLabel,
} from '../shadow-labels';
import { label } from '../labels';
import { ShadowEditFormComponent } from '../widgets/shadow-edit-form';

type Overrides = Partial<Record<ErrorKind, string>>;

const REPORT_ERRORS: Overrides = {
  forbidden: 'Solo el médico que ordenó puede ver los hallazgos en sombra de esta orden.',
  conflict: 'No se pueden interpretar los resultados de esta orden (por ejemplo, hay resultados ambiguos).',
};
const SNAPSHOT_ERRORS: Overrides = {
  forbidden: 'Solo el médico que ordenó puede guardar una instantánea.',
  conflict: 'No se pueden interpretar los resultados de esta orden, así que no se guardó nada.',
};
const EDIT_ERRORS: Overrides = {
  forbidden: 'Solo el médico que ordenó puede registrar esta acción.',
  not_found: 'No encontramos la instantánea o el hallazgo.',
  validation: 'Revisa la acción: falta el motivo o la categoría no es válida.',
};
const HISTORY_ERRORS: Overrides = {
  forbidden: 'Solo el médico que ordenó puede ver el historial.',
};

/**
 * Container: the shadow findings of one order. The ordering doctor reads them live, freezes them in a
 * snapshot and acts on each finding of that snapshot (confirm, discard or modify, always with a reason).
 * Nothing here changes the order, its results or the proposal's decision.
 */
@Component({
  selector: 'app-shadow-panel',
  imports: [BannerComponent, ChipComponent, ModalComponent, ShadowEditFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stack">
      <h2>Hallazgos en modo sombra</h2>
      <app-banner tone="info">
        Solo informativo: no modifica la orden, los resultados ni tu decisión. Guarda una instantánea para
        registrar qué opinas de cada hallazgo.
      </app-banner>
      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }
      @if (error(); as e) {
        @if (editing() === null) {
          <app-banner tone="danger">{{ e.message }}</app-banner>
        }
      }

      <div class="row">
        <button class="btn" type="button" [disabled]="busy() !== null" (click)="read()">
          @if (busy() === 'report') {
            <span class="spinner" aria-hidden="true"></span> Consultando…
          } @else {
            {{ report() ? 'Actualizar lectura' : 'Consultar hallazgos' }}
          }
        </button>
        @if (canRecord()) {
          <button
            class="btn btn--primary"
            type="button"
            [disabled]="busy() !== null"
            (click)="takeSnapshot()"
          >
            @if (busy() === 'snapshot') {
              <span class="spinner" aria-hidden="true"></span> Guardando…
            } @else {
              Guardar instantánea
            }
          </button>
        }
      </div>

      @if (report(); as r) {
        <ul class="list">
          @for (finding of r.findings; track finding.key) {
            <li class="item">
              <div class="row">
                <strong>{{ findingName(finding.key) }}</strong>
                <app-chip [tone]="finding.category === 'NO_EVALUABLE' ? 'warning' : 'info'">
                  {{ category(finding.category) }}
                </app-chip>
              </div>
              @if (finding.cutoff; as cut) {
                <p class="muted small">Punto de corte: {{ cut.value }} {{ cut.unit }}</p>
              }
              @if (finding.reason) {
                <p class="muted small">{{ finding.reason }}</p>
              }
              @if (finding.notice) {
                <p class="small">{{ finding.notice }}</p>
              }
              @if (finding.source) {
                <p class="muted small">Fuente: {{ finding.source }}</p>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="muted small">
          Consulta lo que el sistema concluiría con los resultados de esta orden. No se guarda nada.
        </p>
      }

      @if (snapshot(); as s) {
        <h3>Instantánea guardada</h3>
        <p class="muted small">
          {{ date(s.createdAt) }} {{ s.createdAt.slice(11, 16) }} UTC · reglas {{ s.ruleVersion }}. Es
          inmutable: si cambian los resultados, guarda otra.
        </p>
        <ul class="list">
          @for (item of s.items; track item.finding) {
            <li class="item">
              <div class="row">
                <strong>{{ findingName(item.finding) }}</strong>
                <app-chip [tone]="item.category === 'NO_EVALUABLE' ? 'warning' : 'info'">
                  {{ category(item.category) }}
                </app-chip>
              </div>
              @if (item.cutoff; as cut) {
                <p class="muted small">Punto de corte: {{ cut.value }} {{ cut.unit }}</p>
              }
              @if (item.reason) {
                <p class="muted small">{{ item.reason }}</p>
              }
              @if (item.evidence.length > 0) {
                <p class="muted small">
                  Evidencia:
                  @for (e of item.evidence; track e.resultId; let last = $last) {
                    {{ role(e.role) }} {{ e.value }} {{ e.unit ?? '' }}{{ last ? '' : ' · ' }}
                  }
                </p>
              }
              @if (item.source) {
                <p class="muted small">Fuente: {{ item.source }}</p>
              }
              <div class="row">
                <button
                  class="btn"
                  type="button"
                  [disabled]="busy() !== null"
                  (click)="openEdit(item)"
                >
                  Registrar acción
                </button>
                <button
                  class="btn"
                  type="button"
                  [disabled]="busy() !== null"
                  (click)="loadHistory(s, item.finding)"
                >
                  {{ edits()[item.finding] ? 'Actualizar historial' : 'Ver historial' }}
                </button>
              </div>
              @if (edits()[item.finding]; as history) {
                @if (history.length === 0) {
                  <p class="muted small">Todavía no hay acciones sobre este hallazgo.</p>
                } @else {
                  <ol class="history">
                    @for (edit of history; track edit.id) {
                      <li>
                        <span class="small">
                          <strong>{{ past(edit.action) }}</strong>
                          @if (edit.action === 'MODIFICAR') {
                            : {{ category(edit.previousCategory) }} → {{ category(edit.newCategory) }}
                          } @else if (edit.action === 'DESCARTAR') {
                            : {{ category(edit.previousCategory) }}
                          }
                          · {{ date(edit.createdAt) }} {{ edit.createdAt.slice(11, 16) }} UTC
                        </span>
                        <span class="muted small">Motivo: {{ edit.reason }}</span>
                      </li>
                    }
                  </ol>
                }
              }
            </li>
          }
        </ul>
      }
    </section>

    @if (editing(); as item) {
      <app-modal
        tag="Hallazgo en sombra"
        headline="Registra tu acción sobre el hallazgo"
        [bullets]="editBullets"
        (closed)="closeEdit()"
      >
        @if (error(); as e) {
          <app-banner tone="danger">{{ e.message }}</app-banner>
        }
        <app-shadow-edit-form
          [finding]="item.finding"
          [currentCategory]="item.category"
          [busy]="busy() === 'edit'"
          (submitted)="saveEdit(item, $event)"
        />
      </app-modal>
    }
  `,
  styles: `
    .list,
    .history {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }
    .item {
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      display: grid;
      gap: 6px;
    }
    .item p {
      margin: 0;
    }
    .history li {
      display: grid;
      gap: 2px;
      border-left: 3px solid var(--blue-soft);
      padding-left: 10px;
    }
  `,
})
export class ShadowPanelComponent {
  readonly orderId = input.required<string>();
  /** The ordering doctor may freeze a snapshot and act on its findings. */
  readonly canRecord = input(false);

  private readonly getReport = inject(GetShadowReport);
  private readonly recordSnapshot = inject(RecordShadowSnapshot);
  private readonly editFinding = inject(EditShadowFinding);
  private readonly listEdits = inject(ListShadowEdits);

  protected readonly report = signal<ShadowReport | null>(null);
  protected readonly snapshot = signal<ShadowSnapshot | null>(null);
  protected readonly edits = signal<Partial<Record<EditableFinding, readonly ShadowEdit[]>>>({});
  protected readonly editing = signal<ShadowSnapshotItem | null>(null);
  protected readonly busy = signal<'report' | 'snapshot' | 'edit' | 'history' | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  protected readonly editBullets = [
    'Tu acción se agrega al historial y nunca borra la sugerencia.',
    'Toda acción lleva un motivo.',
    'Nada de esto cambia la orden ni la propuesta.',
  ];

  protected readonly findingName = findingLabel;
  protected readonly category = categoryLabel;
  protected readonly role = roleLabel;
  protected readonly date = formatDate;
  protected readonly past = (code: string) => label(SHADOW_ACTION_PAST, code);

  protected async read(): Promise<void> {
    await this.run('report', REPORT_ERRORS, async () => {
      this.report.set(await this.getReport.execute(this.orderId()));
    });
  }

  protected async takeSnapshot(): Promise<void> {
    await this.run('snapshot', SNAPSHOT_ERRORS, async () => {
      this.snapshot.set(await this.recordSnapshot.execute(this.orderId()));
      // A new snapshot starts with no actions of its own.
      this.edits.set({});
      this.notice.set('Instantánea guardada. Ya puedes registrar tu acción sobre cada hallazgo.');
    });
  }

  protected openEdit(item: ShadowSnapshotItem): void {
    this.error.set(null);
    this.editing.set(item);
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected async saveEdit(item: ShadowSnapshotItem, edit: NewShadowEdit): Promise<void> {
    const snapshot = this.snapshot();
    if (!snapshot) return;
    await this.run('edit', EDIT_ERRORS, async () => {
      await this.editFinding.execute(this.orderId(), snapshot.id, item.finding, item.category, edit);
      this.editing.set(null);
      this.notice.set('Acción registrada en el historial.');
      await this.fetchHistory(snapshot, item.finding);
    });
  }

  protected async loadHistory(snapshot: ShadowSnapshot, finding: EditableFinding): Promise<void> {
    await this.run('history', HISTORY_ERRORS, () => this.fetchHistory(snapshot, finding));
  }

  private async fetchHistory(snapshot: ShadowSnapshot, finding: EditableFinding): Promise<void> {
    const history = await this.listEdits.execute(this.orderId(), snapshot.id, finding);
    this.edits.update((all) => ({ ...all, [finding]: history }));
  }

  private async run(
    name: 'report' | 'snapshot' | 'edit' | 'history',
    overrides: Overrides,
    action: () => Promise<void>,
  ): Promise<void> {
    this.busy.set(name);
    this.notice.set(null);
    this.error.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set(describeError(error, overrides));
    } finally {
      this.busy.set(null);
    }
  }
}
