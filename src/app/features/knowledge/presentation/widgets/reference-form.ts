import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { toIsoDate } from '../../../../core/domain/dates';
import { NewReference } from '../../domain/entities/knowledge';
import { referenceProblems } from '../../domain/policies/knowledge-policies';
import { REFERENCE_PROBLEM_LABELS, labelOf } from '../labels';

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

@Component({
  selector: 'app-reference-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
      <div class="grid-2">
        <div class="field">
          <label for="ref-source">Fuente (ID)</label>
          <input id="ref-source" class="input mono" formControlName="sourceId" />
          @if (form.controls.sourceId.touched && form.controls.sourceId.invalid) {
            <span class="field-error">Escribe el UUID de la fuente.</span>
          } @else {
            <span class="hint"
              >El sistema aún no lista las fuentes: pega el ID de una existente.</span
            >
          }
        </div>
        <div class="field">
          <label for="ref-unit">Unidad</label>
          <input id="ref-unit" class="input" formControlName="unit" maxlength="40" />
          @if (form.controls.unit.touched && form.controls.unit.invalid) {
            <span class="field-error">La unidad es obligatoria.</span>
          }
        </div>
        <div class="field">
          <label for="ref-min">Mínimo</label>
          <input id="ref-min" class="input" type="number" step="any" formControlName="min" />
        </div>
        <div class="field">
          <label for="ref-max">Máximo</label>
          <input id="ref-max" class="input" type="number" step="any" formControlName="max" />
        </div>
        <div class="field">
          <label for="ref-start">Vigente desde</label>
          <input id="ref-start" class="input" type="date" formControlName="startDate" />
          @if (form.controls.startDate.touched && form.controls.startDate.invalid) {
            <span class="field-error">La fecha de inicio es obligatoria.</span>
          }
        </div>
        <div class="field">
          <label for="ref-end">Vigente hasta (opcional)</label>
          <input id="ref-end" class="input" type="date" formControlName="endDate" />
        </div>
        <div class="field">
          <label for="ref-sex">Sexo (opcional)</label>
          <input id="ref-sex" class="input" formControlName="sex" maxlength="30" />
          <span class="hint">Debe coincidir con el sexo registrado del paciente.</span>
        </div>
        <div class="field">
          <label for="ref-age-min">Edad mínima, en días (opcional)</label>
          <input
            id="ref-age-min"
            class="input"
            type="number"
            min="0"
            formControlName="minAgeDays"
          />
        </div>
        <div class="field">
          <label for="ref-age-max">Edad máxima, en días (opcional)</label>
          <input
            id="ref-age-max"
            class="input"
            type="number"
            min="0"
            formControlName="maxAgeDays"
          />
        </div>
        <div class="field">
          <label for="ref-method">Método (opcional)</label>
          <input id="ref-method" class="input" formControlName="method" maxlength="150" />
        </div>
        <div class="field">
          <label for="ref-sample">Tipo de muestra (opcional)</label>
          <input id="ref-sample" class="input" formControlName="sampleType" maxlength="80" />
        </div>
        <div class="field">
          <label for="ref-context">Contexto (opcional)</label>
          <input id="ref-context" class="input" formControlName="context" maxlength="100" />
        </div>
      </div>

      @for (problem of problems(); track problem) {
        <span class="field-error">{{ problemLabel(problem) }}</span>
      }
      <div class="row">
        <button class="btn btn--primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : 'Crear borrador' }}
        </button>
        <span class="hint">Un médico debe validar el borrador antes de que se use.</span>
      </div>
    </form>
  `,
})
export class ReferenceFormComponent {
  readonly busy = input(false);
  readonly defaultUnit = input<string | null>(null);
  readonly defaultSourceId = input<string | null>(null);
  readonly submitted = output<NewReference>();

  protected readonly problems = signal<readonly string[]>([]);
  protected readonly problemLabel = (code: string) => labelOf(REFERENCE_PROBLEM_LABELS, code);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    sourceId: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
    unit: ['', [Validators.required, Validators.maxLength(40)]],
    min: [null as number | null],
    max: [null as number | null],
    sex: [''],
    minAgeDays: [null as number | null, [Validators.min(0)]],
    maxAgeDays: [null as number | null, [Validators.min(0)]],
    method: [''],
    sampleType: [''],
    context: [''],
    startDate: [toIsoDate(new Date()), [Validators.required]],
    endDate: [''],
  });

  constructor() {
    // Prefill from the analyte and the dev source once the parent provides them, without
    // overwriting something the user already typed.
    effect(() => {
      const unit = this.defaultUnit();
      const source = this.defaultSourceId();
      untracked(() => {
        if (unit && !this.form.controls.unit.value) this.form.controls.unit.setValue(unit);
        if (source && !this.form.controls.sourceId.value) {
          this.form.controls.sourceId.setValue(source);
        }
      });
    });
  }

  reset(): void {
    this.form.reset();
    this.form.controls.startDate.setValue(toIsoDate(new Date()));
    this.problems.set([]);
    const unit = this.defaultUnit();
    const source = this.defaultSourceId();
    if (unit) this.form.controls.unit.setValue(unit);
    if (source) this.form.controls.sourceId.setValue(source);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const reference: NewReference = {
      sourceId: v.sourceId.trim(),
      unit: v.unit.trim(),
      min: v.min,
      max: v.max,
      sex: v.sex.trim() || null,
      minAgeDays: v.minAgeDays,
      maxAgeDays: v.maxAgeDays,
      method: v.method.trim() || null,
      sampleType: v.sampleType.trim() || null,
      context: v.context.trim() || null,
      startDate: v.startDate,
      endDate: v.endDate || null,
    };
    const problems = referenceProblems(reference);
    this.problems.set(problems);
    if (problems.length === 0) this.submitted.emit(reference);
  }
}
