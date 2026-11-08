import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  Analyte,
  NewRule,
  OPERATORS,
  Operator,
  RULE_LOGICS,
  RULE_PRIORITIES,
  RULE_TYPES,
  RuleLogic,
  RulePriority,
  RuleType,
} from '../../domain/entities/knowledge';
import { isNumericOperator, ruleProblems } from '../../domain/policies/knowledge-policies';
import {
  OPERATOR_LABELS,
  RULE_LOGIC_LABELS,
  RULE_PRIORITY_LABELS,
  RULE_PROBLEM_LABELS,
  RULE_TYPE_LABELS,
  labelOf,
} from '../labels';

@Component({
  selector: 'app-rule-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
      <div class="grid-2">
        <div class="field">
          <label for="rule-code">Código</label>
          <input id="rule-code" class="input mono" formControlName="code" maxlength="80" />
          @if (form.controls.code.touched && form.controls.code.invalid) {
            <span class="field-error">Escribe un código de al menos 2 caracteres.</span>
          }
        </div>
        <div class="field">
          <label for="rule-name">Nombre</label>
          <input id="rule-name" class="input" formControlName="name" maxlength="200" />
          @if (form.controls.name.touched && form.controls.name.invalid) {
            <span class="field-error">El nombre es obligatorio.</span>
          }
        </div>
        <div class="field">
          <label for="rule-type">Tipo</label>
          <select id="rule-type" class="input" formControlName="type">
            @for (t of types; track t) {
              <option [value]="t">{{ typeLabel(t) }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="rule-priority">Prioridad</label>
          <select id="rule-priority" class="input" formControlName="priority">
            @for (p of priorities; track p) {
              <option [value]="p">{{ priorityLabel(p) }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="rule-logic">Combinación de criterios</label>
          <select id="rule-logic" class="input" formControlName="logic">
            @for (l of logics; track l) {
              <option [value]="l">{{ logicLabel(l) }}</option>
            }
          </select>
        </div>
      </div>
      <div class="field">
        <label for="rule-description">Descripción (opcional)</label>
        <input id="rule-description" class="input" formControlName="description" maxlength="1500" />
      </div>
      <div class="field">
        <label for="rule-message">Mensaje de la propuesta</label>
        <textarea
          id="rule-message"
          class="input"
          rows="3"
          formControlName="message"
          maxlength="2000"
        ></textarea>
        @if (form.controls.message.touched && form.controls.message.invalid) {
          <span class="field-error">El mensaje es obligatorio.</span>
        }
      </div>

      <fieldset class="criteria stack" formArrayName="criteria">
        <legend class="field-label">Criterios</legend>
        @for (criterion of criteria.controls; track $index; let i = $index) {
          <div class="criterion" [formGroupName]="i">
            <div class="field">
              <label [for]="'c-analyte-' + i">Analito</label>
              <select [id]="'c-analyte-' + i" class="input" formControlName="analyteId">
                <option value="" disabled>Elige un analito</option>
                @for (analyte of analytes(); track analyte.id) {
                  <option [value]="analyte.id">{{ analyte.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label [for]="'c-op-' + i">Condición</label>
              <select [id]="'c-op-' + i" class="input" formControlName="operator">
                @for (op of operators; track op) {
                  <option [value]="op">{{ operatorLabel(op) }}</option>
                }
              </select>
            </div>
            @if (isNumeric(criterion.controls.operator.value)) {
              <div class="field">
                <label [for]="'c-threshold-' + i">Umbral</label>
                <input
                  [id]="'c-threshold-' + i"
                  class="input"
                  type="number"
                  step="any"
                  formControlName="threshold"
                />
              </div>
              <div class="field">
                <label [for]="'c-unit-' + i">Unidad</label>
                <input [id]="'c-unit-' + i" class="input" formControlName="unit" maxlength="40" />
              </div>
            }
            <button
              class="btn btn--ghost btn--small"
              type="button"
              (click)="removeCriterion(i)"
              [disabled]="criteria.length === 1"
            >
              Quitar
            </button>
          </div>
        }
        <div class="row">
          <button class="btn btn--small" type="button" (click)="addCriterion()">
            + Agregar criterio
          </button>
        </div>
      </fieldset>

      @for (problem of problems(); track problem) {
        <span class="field-error">{{ problemLabel(problem) }}</span>
      }
      <div class="row">
        <button class="btn btn--primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : 'Crear borrador de regla' }}
        </button>
        <span class="hint">Un médico debe validar el borrador antes de que se ejecute.</span>
      </div>
    </form>
  `,
  styles: `
    .criteria {
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 14px;
      margin: 0;
    }
    .criterion {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)) auto;
      align-items: end;
      padding-bottom: 12px;
      border-bottom: 1px dashed var(--line);
    }
  `,
})
export class RuleFormComponent {
  readonly analytes = input.required<readonly Analyte[]>();
  readonly busy = input(false);
  readonly submitted = output<NewRule>();

  protected readonly types = RULE_TYPES;
  protected readonly priorities = RULE_PRIORITIES;
  protected readonly logics = RULE_LOGICS;
  protected readonly operators = OPERATORS;
  protected readonly problems = signal<readonly string[]>([]);

  protected readonly typeLabel = (c: string) => labelOf(RULE_TYPE_LABELS, c);
  protected readonly priorityLabel = (c: string) => labelOf(RULE_PRIORITY_LABELS, c);
  protected readonly logicLabel = (c: string) => labelOf(RULE_LOGIC_LABELS, c);
  protected readonly operatorLabel = (c: string) => labelOf(OPERATOR_LABELS, c);
  protected readonly problemLabel = (c: string) => labelOf(RULE_PROBLEM_LABELS, c);
  protected readonly isNumeric = isNumericOperator;

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    type: ['HALLAZGO' as RuleType],
    priority: ['INFORMATIVA' as RulePriority],
    logic: ['TODOS' as RuleLogic],
    message: ['', [Validators.required, Validators.maxLength(2000)]],
    criteria: this.fb.array([this.newCriterion()]),
  });

  protected get criteria() {
    return this.form.controls.criteria;
  }

  addCriterion(): void {
    if (this.criteria.length < 10) this.criteria.push(this.newCriterion());
  }

  removeCriterion(index: number): void {
    if (this.criteria.length > 1) this.criteria.removeAt(index);
  }

  reset(): void {
    this.form.reset();
    this.criteria.clear();
    this.criteria.push(this.newCriterion());
    this.problems.set([]);
  }

  protected submit(): void {
    const hasUnpickedAnalyte = this.criteria.controls.some((c) => !c.controls.analyteId.value);
    if (this.form.invalid || hasUnpickedAnalyte) {
      this.form.markAllAsTouched();
      if (hasUnpickedAnalyte) this.problems.set(['no_analyte']);
      return;
    }
    const v = this.form.getRawValue();
    const rule: NewRule = {
      code: v.code.trim(),
      name: v.name.trim(),
      description: v.description.trim() || null,
      type: v.type,
      logic: v.logic,
      message: v.message.trim(),
      priority: v.priority,
      criteria: v.criteria.map((c) => ({
        analyteId: c.analyteId,
        operator: c.operator,
        threshold: c.threshold,
        unit: c.unit.trim() || null,
      })),
    };
    const problems = ruleProblems(rule);
    this.problems.set(problems);
    if (problems.length === 0) this.submitted.emit(rule);
  }

  private newCriterion() {
    return this.fb.group({
      analyteId: [''],
      operator: ['LT' as Operator],
      threshold: [null as number | null],
      unit: [''],
    });
  }
}
