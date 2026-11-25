import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { validateMotivo } from '../../domain/policies/historia-policies';
import { STATE_LABEL, problemsSentence } from '../labels';

/** Changes an entry's state. Offers only the states the backend accepts from the current one. */
@Component({
  selector: 'app-state-form',
  imports: [BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .form {
      display: grid;
      gap: 14px;
    }
    .field {
      display: grid;
      gap: 4px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .hint {
      margin: 0;
      font-size: 13px;
      color: var(--muted, #475569);
    }
    select:focus-visible,
    input:focus-visible,
    button:focus-visible {
      outline: 3px solid var(--blue, #2563eb);
      outline-offset: 2px;
    }
  `,
  template: `
    @if (problem(); as text) {
      <app-banner tone="danger">{{ text }}</app-banner>
    }
    @if (targets().length === 0) {
      <p class="hint">Esta entrada ya no puede cambiar de estado.</p>
    } @else {
      <form class="form" (submit)="onSubmit($event)" novalidate>
        <label class="field">
          <strong>Nuevo estado</strong>
          <select class="input" name="target" [value]="target()" (change)="target.set(value($event))">
            <option value="">Elige el nuevo estado</option>
            @for (state of targets(); track state) {
              <option [value]="state">{{ label(state) }}</option>
            }
          </select>
        </label>
        <label class="field">
          <strong>Motivo</strong>
          <input class="input" name="reason" maxlength="500" [value]="reason()" (input)="reason.set(value($event))" />
          <span class="hint">Queda registrado en la bitácora junto con el cambio.</span>
        </label>
        <div class="actions">
          <button type="submit" class="btn btn--primary" [disabled]="busy()">
            {{ busy() ? 'Guardando…' : 'Cambiar estado' }}
          </button>
          <button type="button" class="btn btn--ghost" (click)="cancel.emit()" [disabled]="busy()">Cancelar</button>
        </div>
      </form>
    }
  `,
})
export class StateFormComponent {
  /** The states it can move to. The page computes them with the same rules as the backend. */
  readonly targets = input<readonly string[]>([]);
  readonly busy = input(false);
  readonly serverError = input<string | null>(null);

  readonly submitChange = output<{ target: string; reason: string }>();
  readonly cancel = output<void>();

  protected readonly target = signal('');
  protected readonly reason = signal('');
  private readonly submitted = signal(false);

  protected readonly problem = computed<string | null>(() => {
    if (!this.submitted()) return this.serverError();
    const problems = [...(this.target() ? [] : ['empty']), ...validateMotivo(this.reason())];
    return problems.length > 0 ? problemsSentence(problems) : this.serverError();
  });

  protected value(event: Event): string {
    return (event.target as HTMLSelectElement | HTMLInputElement).value;
  }

  protected label(state: string): string {
    return STATE_LABEL[state] ?? state;
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    const local = [...(this.target() ? [] : ['empty']), ...validateMotivo(this.reason())];
    if (local.length > 0 || this.busy()) return;
    this.submitChange.emit({ target: this.target(), reason: this.reason().trim() });
  }
}
