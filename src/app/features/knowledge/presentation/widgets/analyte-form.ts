import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { sanitizeUnit } from '../../../../core/domain/text';
import { sanitizeOnType } from '../../../../shared/presentation/forms/sanitize-on-type';
import { NewAnalyte, VALUE_TYPES, ValueType } from '../../domain/entities/knowledge';
import { VALUE_TYPE_LABELS, labelOf } from '../labels';

/** Letters and "/" only, at most 10 characters (well under the 40 the database allows). */
const UNIT_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ/]*$/;
const UNIT_MAX_LENGTH = 10;

@Component({
  selector: 'app-analyte-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
      <div class="grid-2">
        <div class="field">
          <label for="analyte-name">Nombre</label>
          <input id="analyte-name" class="input" formControlName="name" maxlength="150" />
          @if (form.controls.name.touched && form.controls.name.invalid) {
            <span class="field-error">El nombre es obligatorio.</span>
          }
        </div>
        <div class="field">
          <label for="analyte-unit">Unidad (opcional)</label>
          <input
            id="analyte-unit"
            class="input"
            formControlName="unit"
            [maxlength]="unitMaxLength"
            placeholder="mg/dL"
          />
          @if (form.controls.unit.touched && form.controls.unit.invalid) {
            <span class="field-error">La unidad admite solo letras y "/", hasta 10 caracteres.</span>
          }
        </div>
        <div class="field">
          <label for="analyte-type">Tipo de valor</label>
          <select id="analyte-type" class="input" formControlName="valueType">
            @for (type of valueTypes; track type) {
              <option [value]="type">{{ label(type) }}</option>
            }
          </select>
        </div>
      </div>
      <div class="row">
        <button class="btn btn--primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : 'Crear analito' }}
        </button>
      </div>
    </form>
  `,
})
export class AnalyteFormComponent {
  readonly busy = input(false);
  readonly submitted = output<NewAnalyte>();

  protected readonly valueTypes = VALUE_TYPES;
  protected readonly label = (code: string) => labelOf(VALUE_TYPE_LABELS, code);

  protected readonly unitMaxLength = UNIT_MAX_LENGTH;

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    unit: ['', [Validators.maxLength(UNIT_MAX_LENGTH), Validators.pattern(UNIT_PATTERN)]],
    valueType: ['NUMERICO' as ValueType],
  });

  constructor() {
    sanitizeOnType(this.form.controls.unit, sanitizeUnit, this.destroyRef);
  }

  reset(): void {
    this.form.reset();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, unit, valueType } = this.form.getRawValue();
    this.submitted.emit({ name, unit: unit || null, valueType });
  }
}
