import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import {
  AllergySeverity,
  AntecedentType,
  CatalogItem,
  EntryDraft,
  EntryKind,
} from '../../domain/entities/historia';
import {
  validateAllergy,
  validateAntecedent,
  validateMedication,
  validateProblem,
  validateVaccine,
} from '../../domain/policies/historia-policies';
import { ANTECEDENT_TYPE_LABEL, KIND_LABEL, SEVERITY_LABEL, problemsSentence } from '../labels';

/**
 * The form to register one entry. Presentational: it validates against the same rules as the backend
 * before it emits, and shows the refusal under the form. It never calls the API itself.
 */
@Component({
  selector: 'app-entry-form',
  imports: [BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .form {
      display: grid;
      gap: 14px;
    }
    .hint {
      margin: 0;
      font-size: 13px;
      color: var(--muted, #475569);
    }
    .error {
      margin: 0;
      font-size: 13px;
      color: var(--danger, #b91c1c);
      font-weight: 500;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .field {
      display: grid;
      gap: 4px;
    }
    input:focus-visible,
    select:focus-visible,
    button:focus-visible {
      outline: 3px solid var(--blue, #2563eb);
      outline-offset: 2px;
    }
  `,
  template: `
    @if (problem(); as text) {
      <app-banner tone="danger">{{ text }}</app-banner>
    }
    <form class="form" (submit)="onSubmit($event)" novalidate>
      @switch (kind()) {
        @case ('allergy') {
          <label class="field">
            <strong>Sustancia</strong>
            <select name="substance" [value]="substanceCode()" (change)="substanceCode.set(value($event))">
              <option value="">Elige una sustancia</option>
              @for (item of allergens(); track item.code) {
                <option [value]="item.code">{{ item.name }}{{ item.category ? ' · ' + item.category : '' }}</option>
              }
            </select>
          </label>
          <label class="field">
            <strong>Gravedad</strong>
            <select name="severity" [value]="severity()" (change)="severity.set(value($event))">
              <option value="">Elige la gravedad</option>
              @for (level of severities; track level) {
                <option [value]="level">{{ severityLabel(level) }}</option>
              }
            </select>
          </label>
          <label class="field">
            <strong>Reacción</strong>
            <input name="reaction" maxlength="300" [value]="reaction()" (input)="reaction.set(value($event))" />
          </label>
        }
        @case ('antecedent') {
          <label class="field">
            <strong>Tipo</strong>
            <select name="antecedentType" [value]="antecedentType()" (change)="setAntecedentType($event)">
              @for (type of antecedentTypes; track type) {
                <option [value]="type">{{ typeLabel(type) }}</option>
              }
            </select>
          </label>
          <label class="field">
            <strong>Descripción</strong>
            <input name="description" maxlength="500" [value]="description()" (input)="description.set(value($event))" />
          </label>
          @if (antecedentType() === 'FAMILIAR') {
            <label class="field">
              <strong>Familiar</strong>
              <input name="relative" maxlength="50" [value]="relative()" (input)="relative.set(value($event))" />
            </label>
          }
          <label class="field">
            <strong>Código CIE-11 (opcional)</strong>
            <input name="cie11" list="cie11-options" maxlength="20" [value]="cie11()" (input)="cie11.set(value($event))" />
            <datalist id="cie11-options">
              @for (item of cie11Options(); track item.code) {
                <option [value]="item.code">{{ item.name }}</option>
              }
            </datalist>
          </label>
        }
        @case ('medication') {
          <label class="field">
            <strong>Medicamento</strong>
            <input name="medication" maxlength="150" [value]="name()" (input)="name.set(value($event))" />
          </label>
          <label class="field">
            <strong>Dosis (opcional)</strong>
            <input name="dose" maxlength="80" [value]="dose()" (input)="dose.set(value($event))" />
          </label>
          <label class="field">
            <strong>Frecuencia (opcional)</strong>
            <input name="frequency" maxlength="80" [value]="frequency()" (input)="frequency.set(value($event))" />
          </label>
          <label class="field">
            <strong>Desde (opcional)</strong>
            <input name="startDate" type="date" [value]="startDate()" (input)="startDate.set(value($event))" />
          </label>
        }
        @case ('problem') {
          <label class="field">
            <strong>Problema</strong>
            <input name="problem" maxlength="300" [value]="description()" (input)="description.set(value($event))" />
          </label>
          <label class="field">
            <strong>Código CIE-11 (opcional)</strong>
            <input name="cie11" list="cie11-options" maxlength="20" [value]="cie11()" (input)="cie11.set(value($event))" />
            <datalist id="cie11-options">
              @for (item of cie11Options(); track item.code) {
                <option [value]="item.code">{{ item.name }}</option>
              }
            </datalist>
          </label>
          <label class="field">
            <strong>Desde (opcional)</strong>
            <input name="startDate" type="date" [value]="startDate()" (input)="startDate.set(value($event))" />
          </label>
        }
        @case ('vaccine') {
          <label class="field">
            <strong>Vacuna</strong>
            <select name="vaccine" [value]="vaccineCode()" (change)="vaccineCode.set(value($event))">
              <option value="">Elige una vacuna</option>
              @for (item of vaccines(); track item.code) {
                <option [value]="item.code">{{ item.name }}</option>
              }
            </select>
          </label>
          <label class="field">
            <strong>Dosis (1 a 10)</strong>
            <input name="dose" type="number" min="1" max="10" [value]="doseNumber()" (input)="doseNumber.set(value($event))" />
          </label>
          <label class="field">
            <strong>Fecha</strong>
            <input name="date" type="date" [value]="date()" (input)="date.set(value($event))" />
          </label>
          <label class="field">
            <strong>Lote (opcional)</strong>
            <input name="lot" maxlength="40" [value]="lot()" (input)="lot.set(value($event))" />
          </label>
        }
      }
      <p class="hint">
        @if (kind() === 'allergy' || kind() === 'vaccine') {
          Elige de la lista: así el registro queda ligado a un código oficial.
        } @else {
          Lo que registras queda con tu nombre y la fecha de hoy.
        }
      </p>
      <div class="actions">
        <button type="submit" class="btn btn--primary" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : 'Guardar ' + kindLabel().toLowerCase() }}
        </button>
        <button type="button" class="btn btn--ghost" (click)="cancel.emit()" [disabled]="busy()">Cancelar</button>
      </div>
    </form>
  `,
})
export class EntryFormComponent {
  readonly kind = input.required<EntryKind>();
  readonly allergens = input<readonly CatalogItem[]>([]);
  readonly vaccines = input<readonly CatalogItem[]>([]);
  readonly cie11Options = input<readonly CatalogItem[]>([]);
  readonly today = input.required<string>();
  readonly busy = input(false);
  /** A refusal from the server, shown above the form. */
  readonly serverError = input<string | null>(null);

  readonly submitDraft = output<EntryDraft>();
  readonly cancel = output<void>();

  protected readonly severities: readonly AllergySeverity[] = ['LEVE', 'MODERADA', 'GRAVE', 'DESCONOCIDA'];
  protected readonly antecedentTypes: readonly AntecedentType[] = ['PERSONAL', 'FAMILIAR', 'QUIRURGICO'];

  protected readonly substanceCode = signal('');
  protected readonly severity = signal('');
  protected readonly reaction = signal('');
  protected readonly antecedentType = signal<AntecedentType>('PERSONAL');
  protected readonly description = signal('');
  protected readonly relative = signal('');
  protected readonly cie11 = signal('');
  protected readonly name = signal('');
  protected readonly dose = signal('');
  protected readonly frequency = signal('');
  protected readonly startDate = signal('');
  protected readonly vaccineCode = signal('');
  protected readonly doseNumber = signal('1');
  protected readonly date = signal('');
  protected readonly lot = signal('');

  private readonly submitted = signal(false);
  protected readonly kindLabel = computed(() => KIND_LABEL[this.kind()]);

  /** The first refusal to show: the local rules when the person tried to save, else the server's. */
  protected readonly problem = computed<string | null>(() => {
    if (this.submitted()) {
      const local = this.localProblems();
      if (local.length > 0) return problemsSentence(local);
    }
    return this.serverError();
  });

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected setAntecedentType(event: Event): void {
    this.antecedentType.set(this.value(event) as AntecedentType);
  }

  protected severityLabel(level: string): string {
    return SEVERITY_LABEL[level as AllergySeverity];
  }

  protected typeLabel(type: string): string {
    return ANTECEDENT_TYPE_LABEL[type as AntecedentType];
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (this.localProblems().length > 0 || this.busy()) return;
    this.submitDraft.emit(this.draft());
  }

  private localProblems(): readonly string[] {
    switch (this.kind()) {
      case 'allergy':
        return validateAllergy({
          substanceCode: this.substanceCode(),
          severity: this.severity(),
          reaction: this.reaction() || null,
        });
      case 'antecedent':
        return validateAntecedent({
          type: this.antecedentType(),
          description: this.description(),
          relative: this.relative() || null,
          cie11: this.cie11() || null,
        });
      case 'medication':
        return validateMedication({ name: this.name(), dose: this.dose() || null, frequency: this.frequency() || null });
      case 'problem':
        return validateProblem({ description: this.description(), cie11: this.cie11() || null });
      case 'vaccine':
        return validateVaccine(
          {
            vaccineCode: this.vaccineCode(),
            doseNumber: Number(this.doseNumber()),
            date: this.date(),
            lot: this.lot() || null,
          },
          this.today(),
        );
    }
  }

  private draft(): EntryDraft {
    switch (this.kind()) {
      case 'allergy':
        return {
          kind: 'allergy',
          substanceCode: this.substanceCode(),
          severity: this.severity() as AllergySeverity,
          reaction: this.reaction().trim() || null,
        };
      case 'antecedent':
        return {
          kind: 'antecedent',
          type: this.antecedentType(),
          description: this.description().trim(),
          relative: this.relative().trim() || null,
          cie11: this.cie11().trim() || null,
        };
      case 'medication':
        return {
          kind: 'medication',
          name: this.name().trim(),
          dose: this.dose().trim() || null,
          frequency: this.frequency().trim() || null,
          startDate: this.startDate() || null,
        };
      case 'problem':
        return {
          kind: 'problem',
          description: this.description().trim(),
          cie11: this.cie11().trim() || null,
          startDate: this.startDate() || null,
        };
      case 'vaccine':
        return {
          kind: 'vaccine',
          vaccineCode: this.vaccineCode(),
          doseNumber: Number(this.doseNumber()),
          date: this.date(),
          lot: this.lot().trim() || null,
        };
    }
  }
}
