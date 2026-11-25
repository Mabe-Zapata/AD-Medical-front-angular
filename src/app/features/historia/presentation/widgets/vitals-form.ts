import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { VitalMeasures } from '../../domain/entities/historia';
import { validateMotivo, validateVitals } from '../../domain/policies/historia-policies';
import { problemsSentence } from '../labels';

/** Signs taken at an appointment, or a correction of signs already taken. Presentational. */
@Component({
  selector: 'app-vitals-form',
  imports: [BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    .field {
      display: grid;
      gap: 4px;
    }
    .error {
      margin: 0;
      font-size: 13px;
      font-weight: 500;
      color: var(--danger, #b91c1c);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
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
    <form class="stack" (submit)="onSubmit($event)" novalidate>
      @if (mode() === 'record') {
        <label class="field">
          <strong>Cita (identificador)</strong>
          <input class="input" name="appointment" [value]="appointmentId()" (input)="appointmentId.set(value($event))" />
        </label>
      }
      <div class="grid">
        <label class="field"><strong>Peso (kg)</strong>
          <input class="input" name="weight" type="number" step="0.1" [value]="weight()" (input)="weight.set(value($event))" />
        </label>
        <label class="field"><strong>Talla (cm)</strong>
          <input class="input" name="height" type="number" step="0.1" [value]="height()" (input)="height.set(value($event))" />
        </label>
        <label class="field"><strong>Sistólica</strong>
          <input class="input" name="systolic" type="number" [value]="systolic()" (input)="systolic.set(value($event))" />
        </label>
        <label class="field"><strong>Diastólica</strong>
          <input class="input" name="diastolic" type="number" [value]="diastolic()" (input)="diastolic.set(value($event))" />
        </label>
        <label class="field"><strong>Frecuencia cardiaca</strong>
          <input class="input" name="heartRate" type="number" [value]="heartRate()" (input)="heartRate.set(value($event))" />
        </label>
        <label class="field"><strong>Temperatura (°C)</strong>
          <input class="input" name="temperature" type="number" step="0.1" [value]="temperature()" (input)="temperature.set(value($event))" />
        </label>
        <label class="field"><strong>Saturación (%)</strong>
          <input class="input" name="oxygen" type="number" [value]="oxygen()" (input)="oxygen.set(value($event))" />
        </label>
      </div>
      @if (mode() === 'correct') {
        <label class="field">
          <strong>Motivo de la corrección</strong>
          <input class="input" name="reason" maxlength="500" [value]="reason()" (input)="reason.set(value($event))" />
        </label>
      }
      <div class="actions">
        <button type="submit" class="btn btn--primary" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : mode() === 'record' ? 'Registrar signos' : 'Guardar corrección' }}
        </button>
        <button type="button" class="btn btn--ghost" (click)="cancel.emit()" [disabled]="busy()">Cancelar</button>
      </div>
    </form>
  `,
})
export class VitalsFormComponent {
  readonly mode = input<'record' | 'correct'>('record');
  readonly busy = input(false);
  readonly serverError = input<string | null>(null);
  /** The measures being corrected, so the correction starts from what was recorded. */
  readonly initial = input<Partial<VitalMeasures> | null>(null);

  readonly submitRecord = output<{ appointmentId: string; measures: VitalMeasures }>();
  readonly submitCorrection = output<{ measures: VitalMeasures; reason: string }>();
  readonly cancel = output<void>();

  protected readonly appointmentId = signal('');
  protected readonly weight = signal(this.initialValue('weightKg'));
  protected readonly height = signal(this.initialValue('heightCm'));
  protected readonly systolic = signal(this.initialValue('systolic'));
  protected readonly diastolic = signal(this.initialValue('diastolic'));
  protected readonly heartRate = signal(this.initialValue('heartRate'));
  protected readonly temperature = signal(this.initialValue('temperatureC'));
  protected readonly oxygen = signal(this.initialValue('oxygen'));
  protected readonly reason = signal('');
  private readonly submitted = signal(false);

  protected readonly problem = computed<string | null>(() => {
    if (!this.submitted()) return this.serverError();
    const problems = [...validateVitals(this.measures()), ...(this.mode() === 'correct' ? validateMotivo(this.reason()) : [])];
    if (this.mode() === 'record' && !this.appointmentId().trim()) problems.push('empty');
    return problems.length > 0 ? problemsSentence(problems) : this.serverError();
  });

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (this.problem() !== null && this.problem() !== this.serverError()) return;
    if (this.busy()) return;
    if (this.mode() === 'record') {
      this.submitRecord.emit({ appointmentId: this.appointmentId().trim(), measures: this.measures() });
    } else {
      this.submitCorrection.emit({ measures: this.measures(), reason: this.reason().trim() });
    }
  }

  private initialValue(key: keyof VitalMeasures): string {
    const value = this.initial()?.[key];
    return value === null || value === undefined ? '' : String(value);
  }

  private measures(): VitalMeasures {
    return {
      weightKg: toNumber(this.weight()),
      heightCm: toNumber(this.height()),
      systolic: toNumber(this.systolic()),
      diastolic: toNumber(this.diastolic()),
      heartRate: toNumber(this.heartRate()),
      temperatureC: toNumber(this.temperature()),
      oxygen: toNumber(this.oxygen()),
    };
  }
}

function toNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}
