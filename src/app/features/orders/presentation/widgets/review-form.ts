import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { hasEmoji } from '../../../../core/domain/text';

export function noEmojiValidator(control: AbstractControl): ValidationErrors | null {
  if (control.value && hasEmoji(control.value)) {
    return { emoji: true };
  }
  return null;
}

export interface ReviewSubmission {
  readonly conclusion: string;
  readonly recommendations: string;
}

/** Presentational: the medical review that closes an order. Reports it; the page sends it. */
@Component({
  selector: 'app-review-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .field-error {
      color: var(--danger, #dc2626);
      font-size: 13px;
      font-weight: 500;
    }
  `,
  template: `
    <form class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="field">
        <label for="review-conclusion">Conclusión</label>
        <textarea
          id="review-conclusion"
          class="input"
          rows="4"
          maxlength="4000"
          formControlName="conclusion"
        ></textarea>
        <div class="row spread" style="margin-top: 2px;">
          @if (form.controls.conclusion.touched && form.controls.conclusion.errors?.['emoji']) {
            <span class="field-error">La conclusión no puede contener emojis.</span>
          } @else if (form.controls.conclusion.touched && form.controls.conclusion.invalid) {
            <span class="field-error">Escribe la conclusión de la revisión.</span>
          } @else {
            <span></span>
          }
          <span class="muted small">{{ form.controls.conclusion.value.length }} / 4000</span>
        </div>
      </div>
      <div class="field">
        <label for="review-recommendations">Recomendaciones (opcional)</label>
        <textarea
          id="review-recommendations"
          class="input"
          rows="3"
          maxlength="4000"
          formControlName="recommendations"
        ></textarea>
        <div class="row spread" style="margin-top: 2px;">
          @if (form.controls.recommendations.touched && form.controls.recommendations.errors?.['emoji']) {
            <span class="field-error">Las recomendaciones no pueden contener emojis.</span>
          } @else {
            <span></span>
          }
          <span class="muted small">{{ form.controls.recommendations.value.length }} / 4000</span>
        </div>
      </div>
      <p class="muted small">
        La revisión se registra una vez, cuando todos los resultados existen, y cierra la orden.
      </p>
      <button class="btn btn--primary" type="submit" [disabled]="busy()">
        @if (busy()) {
          <span class="spinner" aria-hidden="true"></span> Registrando…
        } @else {
          Registrar revisión
        }
      </button>
    </form>
  `,
})
export class ReviewFormComponent {
  readonly busy = input(false);
  readonly submitted = output<ReviewSubmission>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    conclusion: ['', [Validators.required, Validators.pattern(/\S/), noEmojiValidator]],
    recommendations: ['', [noEmojiValidator]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitted.emit(this.form.getRawValue());
  }
}
