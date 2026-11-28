import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { normalizeSearch, sanitizeName } from '../../../../core/domain/text';
import { PatientOption } from '../../domain/entities/orders';

const MAX_SHOWN = 6;

/** Presentational: a search box that narrows the doctor's patients as they type and reports the chosen one. */
@Component({
  selector: 'app-patient-picker',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <input
        id="patient-search"
        class="input"
        name="patientSearch"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="patient-options"
        [attr.aria-expanded]="open()"
        autocomplete="off"
        maxlength="100"
        placeholder="Escribe el nombre del paciente"
        [ngModel]="query()"
        (ngModelChange)="type($event)"
        (focus)="open.set(true)"
        (keydown.escape)="open.set(false)"
      />
      @if (open() && !loading() && !failed()) {
        <ul id="patient-options" class="options" role="listbox">
          @for (patient of matches(); track patient.id) {
            <li role="option" [attr.aria-selected]="patient.id === selectedId()">
              <button type="button" (click)="pick(patient)">{{ patient.name }}</button>
            </li>
          } @empty {
            <li class="none" role="option" aria-disabled="true">
              {{ options().length === 0 ? 'Todavía no tienes pacientes a tu cargo.' : 'No existe ningún paciente con ese nombre.' }}
            </li>
          }
        </ul>
      }
      @if (loading()) {
        <span class="hint">Cargando pacientes…</span>
      } @else if (failed()) {
        <span class="field-error">No pudimos cargar tus pacientes. Cierra y vuelve a abrir el formulario.</span>
      }
    </div>
  `,
  styles: `
    .picker {
      position: relative;
    }
    .options {
      position: absolute;
      inset-inline: 0;
      z-index: 5;
      margin: 4px 0 0;
      padding: 4px;
      list-style: none;
      max-height: 240px;
      overflow-y: auto;
      background: #fff;
      border: 1px solid var(--border, #dbe3f0);
      border-radius: 12px;
      box-shadow: 0 12px 28px rgba(15, 30, 60, 0.14);
    }
    .options button {
      width: 100%;
      padding: 10px 12px;
      text-align: left;
      background: none;
      border: 0;
      border-radius: 8px;
      font: inherit;
      cursor: pointer;
    }
    .options button:hover,
    .options button:focus-visible {
      background: var(--blue-tint, #eef3fb);
    }
    .none,
    .hint {
      padding: 10px 12px;
      color: var(--muted, #5b667a);
      font-size: 0.875rem;
    }
  `,
})
export class PatientPickerComponent {
  readonly options = input.required<readonly PatientOption[]>();
  readonly loading = input(false);
  readonly failed = input(false);
  readonly picked = output<PatientOption | null>();

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly matches = computed(() => {
    const needle = normalizeSearch(this.query());
    const found = this.options().filter((p) => normalizeSearch(p.name).includes(needle));
    return found.slice(0, MAX_SHOWN);
  });

  protected type(text: string): void {
    this.query.set(sanitizeName(text));
    this.open.set(true);
    if (this.selectedId() !== null) {
      this.selectedId.set(null);
      this.picked.emit(null);
    }
  }

  protected pick(patient: PatientOption): void {
    this.query.set(patient.name);
    this.selectedId.set(patient.id);
    this.open.set(false);
    this.picked.emit(patient);
  }
}
