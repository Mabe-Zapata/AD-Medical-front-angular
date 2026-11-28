import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { sanitizeResultValue, sanitizeUnit } from '../../../../core/domain/text';
import { sanitizeOnType } from '../../../../shared/presentation/forms/sanitize-on-type';
import { NewResult, OrderTest, TestAnalyte } from '../../domain/entities/orders';
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

/** One analyte row as typed, kept so an unsent form can come back exactly as it was. */
export interface AnalyteRowDraft {
  readonly analyteId: string;
  readonly value: string;
  readonly unit: string;
}

export interface ResultsFormDraft {
  readonly detailId: string;
  readonly rows: readonly AnalyteRowDraft[];
}

/** Presentational: the results of one test, typed by hand. Reports them; the page sends them. */
@Component({
  selector: 'app-results-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="stack results-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <header class="results-bar">
        <button class="btn btn--ghost btn--small" type="button" (click)="back.emit()">
          ← Regresar
        </button>
        <div class="progress" aria-live="polite">
          <span class="muted small">Obligatorios registrados</span>
          <strong>{{ completedMandatory() }} de {{ mandatoryCount() }}</strong>
        </div>
      </header>

      <div class="field">
        @if (tests().length > 0) {
          <label for="result-test">Prueba</label>
          <select id="result-test" class="input" formControlName="detailId" (change)="testPicked()">
            <option value="" disabled>Elige una prueba</option>
            @for (test of tests(); track test.detailId) {
              <option [value]="test.detailId">{{ testLabel(test) }}</option>
            }
          </select>
          @if (form.controls.detailId.touched && form.controls.detailId.invalid) {
            <span class="field-error">Elige la prueba a la que pertenecen los resultados.</span>
          }
        } @else {
          <span class="field-label">Identificador de la prueba</span>
          <span id="result-test" class="mono">{{ form.controls.detailId.value }}</span>
          @if (form.controls.detailId.invalid) {
            <span class="field-error">No hay una prueba seleccionada.</span>
          }
        }
      </div>

      @for (row of rows.controls; track row; let i = $index) {
        <article class="result-card" [formGroup]="row">
          <div class="result-card-head">
            <strong>{{ analyteName(i) || 'Analito sin elegir' }}</strong>
            @if (isMandatory(i)) {
              <span class="tag tag--required">Obligatorio</span>
            } @else {
              <span class="tag">Opcional</span>
            }
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
          <div class="result-fields">
            <div class="field">
              <label [for]="'analyte-' + i">Analito</label>
              <select [id]="'analyte-' + i" class="input" formControlName="analyteId" (change)="pickAnalyte(i)">
                <option value="" disabled>Elige un analito</option>
                @for (analyte of analytes(); track analyte.id) {
                  <option [value]="analyte.id">{{ analyte.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label [for]="'value-' + i">Valor</label>
              <input
                #valueInput
                [id]="'value-' + i"
                class="input value"
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
          </div>
        </article>
      }

      @if (analytes().length === 0) {
        <p class="muted small">No hay analitos disponibles: sin ellos no se pueden registrar resultados.</p>
      }

      @if (restored()) {
        <p class="hint">Recuperamos tu borrador guardado en este navegador.</p>
      }

      <footer class="results-actions">
        <button class="btn btn--small" type="button" [disabled]="rows.length >= max" (click)="addRow()">
          + Agregar otro resultado
        </button>
        <button class="btn btn--primary" type="submit" [disabled]="busy() || analytes().length === 0">
          @if (busy()) {
            <span class="spinner" aria-hidden="true"></span> Guardando…
          } @else {
            Guardar resultados
          }
        </button>
      </footer>
    </form>
  `,
  styles: `
    .results-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border, #dbe3f0);
    }
    .progress {
      display: grid;
      justify-items: end;
      gap: 2px;
    }
    .result-card {
      display: grid;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid var(--border, #dbe3f0);
      border-radius: 14px;
      background: #fff;
    }
    .result-card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .result-card-head strong {
      flex: 1 1 200px;
    }
    .tag {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--blue-tint, #eef3fb);
      color: var(--blue-text, #1d4f91);
      font-size: 0.75rem;
      font-weight: 700;
    }
    .tag--required {
      background: #fde7d9;
      color: #7c2d12;
    }
    .result-fields {
      display: grid;
      grid-template-columns: 2fr 1.2fr 1fr;
      gap: 12px;
      align-items: start;
    }
    .value {
      font-size: 1.125rem;
      font-weight: 700;
    }
    .results-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding-top: 6px;
    }
    @media (max-width: 720px) {
      .result-fields {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ResultsFormComponent implements OnInit {
  readonly tests = input<readonly OrderTest[]>([]);
  /** Pre-fills the test identifier when the laboratory came from the worklist. */
  readonly initialDetailId = input('');
  readonly analytes = input<readonly AnalyteOption[]>([]);
  /** The analytes of the chosen test: its mandatory ones become the rows, ready to type. */
  readonly testAnalytes = input<readonly TestAnalyte[]>([]);
  /** A draft saved in this browser for this order, restored when the test matches. */
  readonly draft = input<ResultsFormDraft | null>(null);
  readonly busy = input(false);
  readonly submitted = output<ResultsSubmission>();
  /** What the person typed and whether it differs from what was on screen when the form opened. */
  readonly state = output<{ dirty: boolean; draft: ResultsFormDraft }>();
  readonly back = output<void>();
  protected readonly restored = signal(false);
  /** The test changed: the page loads that test's analytes and passes them back in. */
  readonly testChanged = output<string>();
  private readonly valueInputs = viewChildren<ElementRef<HTMLInputElement>>('valueInput');

  protected readonly max = MAX_RESULTS_PER_TEST;
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.fb.group({
    detailId: ['', [Validators.required, Validators.pattern(UUID)]],
    rows: this.fb.array([this.newRow()]),
  });

  constructor() {
    // Rebuilt whenever the page hands over a different test's analytes.
    effect(() => {
      const analytes = this.testAnalytes();
      untracked(() => this.loadRows(analytes));
    });
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.typed.update((n) => n + 1);
        this.state.emit({ dirty: this.hasTypedValues(), draft: this.snapshot() });
      });
  }

  /** Typed results are the work to protect; the test chosen from the queue is not. */
  private hasTypedValues(): boolean {
    return this.rows.controls.some((row) => row.controls.value.value.trim() !== '');
  }

  /** The form as it is now, in the shape a draft is stored in. */
  snapshot(): ResultsFormDraft {
    return {
      detailId: this.form.controls.detailId.value,
      rows: this.rows.controls.map((row) => ({
        analyteId: row.controls.analyteId.value,
        value: row.controls.value.value,
        unit: row.controls.unit.value,
      })),
    };
  }

  ngOnInit(): void {
    const first = this.tests()[0]?.detailId ?? '';
    // The test in the queue wins; without one, the draft's test; without a draft, the first pending.
    const chosen = this.initialDetailId() || this.draft()?.detailId || first;
    if (chosen) {
      this.form.controls.detailId.setValue(chosen);
      this.testPicked();
    }
    // A draft for this test comes back at once; the analytes it names are matched when they load.
    const draft = this.draft();
    if (draft && draft.detailId === chosen && draft.rows.length > 0) {
      this.rows.clear();
      for (const saved of draft.rows) {
        const row = this.newRow();
        row.patchValue({ analyteId: saved.analyteId, value: saved.value, unit: saved.unit });
        this.rows.push(row);
      }
      this.restored.set(true);
    }
  }

  protected testPicked(): void {
    const test = this.tests().find((t) => t.detailId === this.form.controls.detailId.value);
    if (test) this.testChanged.emit(test.testTypeId);
  }

  /** Counts every change, so the progress line in the template follows what is typed. */
  private readonly typed = signal(0);

  protected completedMandatory(): number {
    this.typed();
    const ids = this.mandatoryIds();
    return this.rows.controls.filter(
      (row) => ids.has(row.controls.analyteId.value) && row.controls.value.value.trim() !== '',
    ).length;
  }

  protected mandatoryCount(): number {
    return this.mandatoryIds().size;
  }

  protected isMandatory(index: number): boolean {
    return this.mandatoryIds().has(this.rows.at(index)?.controls.analyteId.value ?? '');
  }

  protected analyteName(index: number): string {
    return this.optionOf(index)?.name ?? '';
  }

  private mandatoryIds(): Set<string> {
    return new Set(this.testAnalytes().filter((a) => a.mandatory).map((a) => a.id));
  }

  protected get rows() {
    return this.form.controls.rows;
  }

  protected testLabel(test: OrderTest): string {
    return `${test.name ?? 'Prueba'} · ${label(TEST_STATUS_LABELS, test.status)}`;
  }

  protected isNumeric(index: number): boolean {
    return this.optionOf(index)?.valueType === 'NUMERICO';
  }

  /** Mandatory analytes first (the test is complete with them); none marked, then all of them. */
  private loadRows(analytes: readonly TestAnalyte[]): void {
    if (analytes.length === 0) return;
    const mandatory = analytes.filter((a) => a.mandatory);
    const chosen = mandatory.length > 0 ? mandatory : analytes;
    this.rows.clear();
    for (const analyte of chosen) {
      const row = this.newRow();
      row.patchValue({ analyteId: analyte.id, unit: analyte.unit ?? '' });
      this.rows.push(row);
    }
    // The laboratory types values, so the first empty one gets the cursor.
    this.restoreFrom(untracked(() => this.draft()));
    queueMicrotask(() => {
      const index = this.rows.controls.findIndex((row) => !row.controls.value.value);
      this.valueInputs()[index === -1 ? 0 : index]?.nativeElement.focus();
    });
  }

  /** Only a draft for the test on screen is restored; the analytes it names are matched by id. */
  private restoreFrom(draft: ResultsFormDraft | null): void {
    if (!draft || draft.detailId !== this.form.controls.detailId.value) return;
    const saved = new Map(draft.rows.map((row) => [row.analyteId, row]));
    let restored = false;
    for (const row of this.rows.controls) {
      const match = saved.get(row.controls.analyteId.value);
      if (!match) continue;
      row.patchValue({ value: match.value, unit: match.unit });
      restored = true;
    }
    this.restored.set(restored);
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
    sanitizeOnType(group.controls.value, sanitizeResultValue, this.destroyRef);
    sanitizeOnType(group.controls.unit, sanitizeUnit, this.destroyRef);
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
