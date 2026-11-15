import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EditableFinding, NewShadowEdit, SHADOW_ACTIONS, ShadowAction } from '../../domain/entities/shadow';
import { MAX_SHADOW_REASON, SHADOW_CATEGORIES, shadowEditProblems } from '../../domain/policies/shadow-policies';
import { SHADOW_ACTION_LABELS, categoryLabel } from '../shadow-labels';

/** Presentational: the physician's action on one finding of a snapshot. Reports it; the panel sends it. */
@Component({
  selector: 'app-shadow-edit-form',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="stack" (ngSubmit)="submit()" novalidate>
      <p class="muted small">
        Sugerencia del sistema: <strong>{{ category(currentCategory()) }}</strong>. Tu acción se agrega
        al historial; la sugerencia nunca se sobrescribe.
      </p>
      <fieldset class="options">
        <legend class="field-label">Acción</legend>
        @for (option of actions; track option) {
          <label class="option">
            <input
              type="radio"
              name="action"
              [value]="option"
              [ngModel]="action()"
              (ngModelChange)="choose($event)"
            />
            {{ actionLabels[option] }}
          </label>
        }
      </fieldset>

      @if (action() === 'MODIFICAR') {
        <div class="field">
          <label for="shadow-category">Nueva categoría</label>
          <select
            id="shadow-category"
            class="input"
            name="category"
            [ngModel]="newCategory()"
            (ngModelChange)="newCategory.set($event); touched.set(false)"
          >
            <option value="">Elige una categoría</option>
            @for (option of options(); track option) {
              <option [value]="option">{{ category(option) }}</option>
            }
          </select>
          @if (touched() && categoryProblem()) {
            <span class="field-error">Elige una categoría distinta de la sugerida.</span>
          }
        </div>
      }

      <div class="field">
        <label for="shadow-reason">Motivo</label>
        <textarea
          id="shadow-reason"
          class="input"
          rows="3"
          name="reason"
          [maxlength]="maxReason"
          [ngModel]="reason()"
          (ngModelChange)="reason.set($event); touched.set(false)"
        ></textarea>
        @if (touched() && reasonProblem()) {
          <span class="field-error">Escribe el motivo de tu decisión.</span>
        }
      </div>

      <button class="btn btn--primary" type="submit" [disabled]="busy()">
        @if (busy()) {
          <span class="spinner" aria-hidden="true"></span> Registrando…
        } @else {
          Registrar acción
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
export class ShadowEditFormComponent {
  readonly finding = input.required<EditableFinding>();
  readonly currentCategory = input.required<string>();
  readonly busy = input(false);
  readonly submitted = output<NewShadowEdit>();

  protected readonly actions = SHADOW_ACTIONS;
  protected readonly actionLabels = SHADOW_ACTION_LABELS;
  protected readonly maxReason = MAX_SHADOW_REASON;
  protected readonly category = categoryLabel;
  protected readonly action = signal<ShadowAction>('CONFIRMAR');
  protected readonly newCategory = signal('');
  protected readonly reason = signal('');
  protected readonly touched = signal(false);

  /** The categories offered when modifying: every allowed one except the suggestion itself. */
  protected readonly options = computed(() =>
    SHADOW_CATEGORIES[this.finding()].filter((value) => value !== this.currentCategory()),
  );

  protected choose(action: ShadowAction): void {
    this.action.set(action);
    this.touched.set(false);
  }

  protected reasonProblem(): boolean {
    return this.reason().trim().length === 0;
  }

  protected categoryProblem(): boolean {
    return this.action() === 'MODIFICAR' && !this.newCategory();
  }

  private edit(): NewShadowEdit {
    return {
      action: this.action(),
      newCategory: this.action() === 'MODIFICAR' ? this.newCategory() || null : null,
      reason: this.reason(),
    };
  }

  protected submit(): void {
    if (shadowEditProblems(this.finding(), this.currentCategory(), this.edit()).length > 0) {
      this.touched.set(true);
      return;
    }
    this.submitted.emit(this.edit());
  }
}
