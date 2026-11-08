import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NewResult, OrderTest } from '../../domain/entities/orders';
import { MAX_RESULTS_PER_TEST } from '../../domain/policies/orders-policies';
import { TEST_STATUS_LABELS, label } from '../labels';

/** An analyte the laboratory can report, from the clinical knowledge. */
export interface AnalyteOption {
  readonly id: string;
  readonly name: string;
  readonly unit: string | null;
  readonly valueType: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResultsSubmission {
  readonly detailId: string;
  readonly results: readonly NewResult[];
}

/** Presentational: the results of one test, typed by hand. Reports them; the page sends them. */
@Component({
  selector: 'app-results-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="field">
        @if (tests().length > 0) {
          <label for="result-test">Prueba</label>
          <select id="result-test" class="input" formControlName="detailId">
            <option value="" disabled>Elige una prueba</option>
            @for (test of tests(); track test.detailId) {
              <option [value]="test.detailId">
                {{ testLabel(test) }}
              </option>
            }
          </select>
          @if (form.controls.detailId.touched && form.controls.detailId.invalid) {
            <span class="field-error">Elige la prueba a la que pertenecen los resultados.</span>
          }
        } @else {
          <label for="result-test">Identificador de la prueba</label>
          <input
            id="result-test"
            class="input mono"
            formControlName="detailId"
            placeholder="00000000-0000-0000-0000-000000000000"
            autocomplete="off"
          />
          <span class="hint"
            >Lo da el médico que creó la orden (columna «Identificador de la prueba»).</span
          >
          @if (form.controls.detailId.touched && form.controls.detailId.invalid) {
            <span class="field-error">Escribe un identificador válido (formato UUID).</span>
          }
        }
      </div>

      @for (row of rows.controls; track row; let i = $index) {
        <div class="row-group" [formGroup]="row">
          <div class="field">
            <label [for]="'analyte-' + i">Analito</label>
            <select
              [id]="'analyte-' + i"
              class="input"
              formControlName="analyteId"
              (change)="pickAnalyte(i)"
            >
              <option value="" disabled>Elige un analito</option>
              @for (analyte of analytes(); track analyte.id) {
                <option [value]="analyte.id">{{ analyte.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label [for]="'value-' + i">Valor</label>
            <input
              [id]="'value-' + i"
              class="input"
              formControlName="value"
              [attr.inputmode]="isNumeric(i) ? 'decimal' : 'text'"
              autocomplete="off"
            />
            @if (row.controls.value.touched && row.controls.value.invalid) {
              <span class="field-error">
                {{ isNumeric(i) ? 'Escribe un número, por ejemplo 12,5.' : 'Escribe el valor.' }}
              </span>
            }
          </div>
          <div class="field">
            <label [for]="'unit-' + i">Unidad</label>
            <input [id]="'unit-' + i" class="input" formControlName="unit" autocomplete="off" />
          </div>
          <button
            class="btn btn--ghost btn--small"
            type="button"
            [disabled]="rows.length === 1"
            (click)="removeRow(i)"
            [attr.aria-label]="'Quitar el resultado ' + (i + 1)"
          >
            Quitar
          </button>
        </div>
      }

      @if (analytes().length === 0) {
        <p class="muted small">
          No hay analitos disponibles: sin ellos no se pueden registrar resultados.
        </p>
      }

      <div class="row">
        <button
          class="btn btn--small"
          type="button"
          [disabled]="rows.length >= max"
          (click)="addRow()"
        >
          + Agregar otro resultado
        </button>
        <button
          class="btn btn--primary"
          type="submit"
          [disabled]="busy() || analytes().length === 0"
        >
          @if (busy()) {
            <span class="spinner" aria-hidden="true"></span> Guardando…
          } @else {
            Guardar resultados
          }
        </button>
      </div>
    </form>
  `,
  styles: `
    .row-group {
      display: grid;
      grid-template-columns: 2fr 1.5fr 1fr auto;
      gap: 12px;
      align-items: start;
    }
    .row-group .btn {
      margin-top: 28px;
    }
    @media (max-width: 720px) {
      .row-group {
        grid-template-columns: 1fr 1fr;
      }
      .row-group .field:first-child {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class ResultsFormComponent {
  readonly tests = input<readonly OrderTest[]>([]);
  readonly analytes = input<readonly AnalyteOption[]>([]);
  readonly busy = input(false);
  readonly submitted = output<ResultsSubmission>();

  protected readonly max = MAX_RESULTS_PER_TEST;
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    detailId: ['', [Validators.required, Validators.pattern(UUID)]],
    rows: this.fb.array([this.newRow()]),
  });

  protected get rows() {
    return this.form.controls.rows;
  }

  protected testLabel(test: OrderTest): string {
    return `${test.testTypeId.slice(0, 8)}… · ${label(TEST_STATUS_LABELS, test.status)}`;
  }

  protected isNumeric(index: number): boolean {
    return this.optionOf(index)?.valueType === 'NUMERICO';
  }

  protected addRow(): void {
    this.rows.push(this.newRow());
  }

  protected removeRow(index: number): void {
    if (this.rows.length > 1) this.rows.removeAt(index);
  }

  /** The unit of the analyte is the usual one: prefill it, and let the person change it. */
  protected pickAnalyte(index: number): void {
    const option = this.optionOf(index);
    const row = this.rows.at(index);
    row.controls.unit.setValue(option?.unit ?? '');
    row.controls.value.updateValueAndValidity();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const results: NewResult[] = this.rows.controls.map((row, index) => {
      const option = this.optionOf(index)!;
      const raw = row.controls.value.value.trim();
      const numeric = option.valueType === 'NUMERICO';
      return {
        analyteId: option.id,
        analyteName: option.name,
        unit: row.controls.unit.value.trim() || null,
        numericValue: numeric ? Number(raw.replace(',', '.')) : null,
        textValue: numeric ? null : raw,
      };
    });
    this.submitted.emit({ detailId: this.form.controls.detailId.value, results });
  }

  private optionOf(index: number): AnalyteOption | undefined {
    const id = this.rows.at(index)?.controls.analyteId.value;
    return this.analytes().find((a) => a.id === id);
  }

  private newRow() {
    const group = this.fb.group({
      analyteId: ['', [Validators.required]],
      value: ['', [Validators.required, this.valueMatchesType()]],
      unit: [''],
    });
    return group;
  }

  /** A numeric analyte needs a number; the check reads the analyte chosen in the same row. */
  private valueMatchesType() {
    return (control: { value: string; parent?: unknown }) => {
      const parent = control.parent as { controls?: { analyteId?: { value: string } } } | null;
      const option = this.analytes().find((a) => a.id === parent?.controls?.analyteId?.value);
      if (option?.valueType !== 'NUMERICO' || !control.value.trim()) return null;
      return Number.isFinite(Number(control.value.trim().replace(',', '.')))
        ? null
        : { number: true };
    };
  }
}
