import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { EntryDetails, HistoryEntry } from '../../domain/entities/historia';
import { nextStates } from '../../domain/policies/historia-policies';
import { ANTECEDENT_TYPE_LABEL, SEVERITY_LABEL, STATE_LABEL, originLabel } from '../labels';

/**
 * One history entry as a compact card. Presentational: it shows what it is given and emits intent.
 * The kind comes from the entry's details, so the card needs no other input to read itself.
 */
@Component({
  selector: 'app-entry-card',
  imports: [ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 16px;
      border-radius: var(--radius-lg, 16px);
      background: var(--surface, #fff);
      box-shadow: var(--shadow-island, 0 8px 24px rgb(15 23 42 / 8%));
    }
    .head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: flex-start;
    }
    h3 {
      margin: 0;
      font-size: 16px;
      overflow-wrap: anywhere;
    }
    .meta {
      margin: 0;
      font-size: 13px;
      color: var(--muted, #475569);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    button:focus-visible {
      outline: 3px solid var(--blue, #2563eb);
      outline-offset: 2px;
    }
  `,
  template: `
    <article class="card" [attr.aria-label]="title()">
      <header class="head">
        <h3>{{ title() }}</h3>
        @if (entry().state; as state) {
          <app-chip [tone]="state === 'ACTIVA' || state === 'ACTIVO' ? 'success' : 'warning'">
            {{ stateLabel(state) }}
          </app-chip>
        }
      </header>
      <p class="meta">{{ detail() }}</p>
      <div class="chips">
        <app-chip [tone]="entry().verified ? 'info' : 'warning'">{{ origin() }}</app-chip>
      </div>
      <div class="actions">
        @if (!entry().verified) {
          <button type="button" class="btn btn--primary btn--small" (click)="verify.emit()">
            Confirmar como médico
          </button>
        }
        @if (nextStates().length > 0) {
          <button type="button" class="btn btn--small" (click)="changeState.emit()">Cambiar estado</button>
        }
      </div>
    </article>
  `,
})
export class EntryCardComponent {
  readonly entry = input.required<HistoryEntry>();
  readonly verify = output<void>();
  readonly changeState = output<void>();

  protected readonly title = computed(() => titleOf(this.entry().details));
  protected readonly detail = computed(() => detailOf(this.entry().details));
  protected readonly origin = computed(() => originLabel(this.entry().origin, this.entry().verified));
  protected readonly nextStates = computed(() => {
    const kind = this.entry().details.kind;
    return nextStates(kind, this.entry().state);
  });

  protected stateLabel(state: string): string {
    return STATE_LABEL[state] ?? state;
  }
}

function titleOf(details: EntryDetails): string {
  switch (details.kind) {
    case 'allergy':
      return details.substance;
    case 'antecedent':
      return details.description;
    case 'medication':
      return details.name;
    case 'problem':
      return details.description;
    case 'vaccine':
      return details.name;
  }
}

function detailOf(details: EntryDetails): string {
  switch (details.kind) {
    case 'allergy':
      return [`Gravedad: ${SEVERITY_LABEL[details.severity]}`, details.reaction ? `Reacción: ${details.reaction}` : null]
        .filter(Boolean)
        .join(' · ');
    case 'antecedent':
      return [ANTECEDENT_TYPE_LABEL[details.type], details.relative ? `Familiar: ${details.relative}` : null, details.cie11 ? `CIE-11 ${details.cie11}` : null]
        .filter(Boolean)
        .join(' · ');
    case 'medication':
      return [details.dose, details.frequency, details.startDate ? `Desde ${details.startDate}` : null]
        .filter(Boolean)
        .join(' · ') || 'Sin dosis registrada';
    case 'problem':
      return [details.cie11 ? `CIE-11 ${details.cie11}` : null, details.startDate ? `Desde ${details.startDate}` : null]
        .filter(Boolean)
        .join(' · ') || 'Sin fecha de inicio';
    case 'vaccine':
      return `Dosis ${details.doseNumber} · ${details.date}${details.lot ? ` · lote ${details.lot}` : ''}`;
  }
}
