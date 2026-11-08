import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DECISIONS, Decision } from '../../domain/entities/orders';
import { decisionProblems } from '../../domain/policies/orders-policies';
import { DECISION_LABELS } from '../labels';

export interface DecisionSubmission {
  readonly decision: Decision;
  readonly text: string;
}

/** Presentational: the single medical decision on a proposal. Reports it; the page sends it. */
@Component({
  selector: 'app-decision-form',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="stack" (ngSubmit)="submit()" novalidate>
      <fieldset class="options">
        <legend class="field-label">Decisión</legend>
        @for (option of options; track option) {
          <label class="option">
            <input
              type="radio"
              name="decision"
              [value]="option"
              [ngModel]="decision()"
              (ngModelChange)="choose($event)"
            />
            {{ labels[option] }}
          </label>
        }
      </fieldset>

      @if (decision() !== 'ACEPTAR') {
        <div class="field">
          <label for="decision-text">
            {{ decision() === 'CORREGIR' ? 'Conclusión corregida' : 'Motivo del rechazo' }}
          </label>
          <textarea
            id="decision-text"
            class="input"
            rows="4"
            name="text"
            [ngModel]="text()"
            (ngModelChange)="text.set($event); touched.set(false)"
          ></textarea>
          @if (touched() && problem()) {
            <span class="field-error">
              {{
                decision() === 'CORREGIR'
                  ? 'Escribe la conclusión corregida.'
                  : 'Escribe el motivo del rechazo.'
              }}
            </span>
          }
        </div>
      }

      <p class="muted small">La decisión se registra una sola vez y no se puede cambiar.</p>
      <button class="btn btn--primary" type="submit" [disabled]="busy()">
        @if (busy()) {
          <span class="spinner" aria-hidden="true"></span> Registrando…
        } @else {
          Registrar decisión
        }
      </button>
    </form>
  `,
  styles: `
    .options {
      border: 0;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 8px;
    }
    .option {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
  `,
})
export class DecisionFormComponent {
  readonly busy = input(false);
  readonly submitted = output<DecisionSubmission>();

  protected readonly options = DECISIONS;
  protected readonly labels = DECISION_LABELS;
  protected readonly decision = signal<Decision>('ACEPTAR');
  protected readonly text = signal('');
  protected readonly touched = signal(false);

  protected problem(): boolean {
    return decisionProblems(this.decision(), this.text()).length > 0;
  }

  protected choose(decision: Decision): void {
    this.decision.set(decision);
    this.touched.set(false);
  }

  protected submit(): void {
    if (this.problem()) {
      this.touched.set(true);
      return;
    }
    this.submitted.emit({ decision: this.decision(), text: this.text() });
  }
}
