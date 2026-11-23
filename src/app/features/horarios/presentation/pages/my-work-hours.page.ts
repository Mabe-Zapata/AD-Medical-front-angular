import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { describeError } from '../../../../shared/presentation/error-message';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { DAY_NAMES, DoctorHours, WorkBlock } from '../../domain/entities/work-hours';
import { MAX_BLOCKS_PER_DAY, scheduleProblem, timeOptions } from '../../domain/policies/work-hours-policy';
import { GetMyWorkHours, SaveMyWorkHours } from '../../domain/usecases/work-hours-usecases';

/** Long date for the first week the change applies to, in Spanish. */
function longDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Container: the doctor sets the hours they work each week. A change applies from next week on. */
@Component({
  selector: 'app-my-work-hours-page',
  imports: [FormsModule, BannerComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .grid-form {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .grid-form label,
    .day legend + * {
      display: grid;
      gap: 6px;
    }
    .day {
      border: 1px solid var(--line, #e5e7eb);
      border-radius: 14px;
      display: grid;
      gap: 10px;
      padding: 12px 14px;
    }
    .day legend {
      font-weight: 700;
      padding: 0 6px;
    }
    .block {
      align-items: center;
      flex-wrap: wrap;
    }
    .plain {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .hours {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    .visually-hidden {
      border: 0;
      clip: rect(0 0 0 0);
      height: 1px;
      overflow: hidden;
      position: absolute;
      white-space: nowrap;
      width: 1px;
    }
  `,
  template: `
    <div class="stack">
      <app-page-header area="Médico" title="Mi horario de atención" [crumbs]="crumbs">
        <p lede class="muted">
          Los días y horas en que atiendes. El administrador crea tus citas de una hora a partir de esto.
        </p>
      </app-page-header>

      @if (loading()) {
        <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando tu horario…</p>
      } @else if (loadError(); as message) {
        <section class="card stack">
          <app-banner tone="danger">{{ message }}</app-banner>
          <div><button type="button" class="btn" (click)="load()">Reintentar</button></div>
        </section>
      } @else {
        <section class="card stack">
          <h2>Próxima semana en adelante</h2>
          <p class="muted small">
            Los cambios aplican desde el {{ effectiveLabel() }}. La semana en curso y las ya planificadas no cambian.
          </p>

          @for (day of days; track day.index) {
            <fieldset class="day">
              <legend>{{ day.name }}</legend>
              @for (item of blocksOf(day.index); track item.index) {
                <div class="row block">
                  <label>
                    <span class="visually-hidden">Inicio</span>
                    <select [ngModel]="item.block.start" (ngModelChange)="setTime(item.index, 'start', $event)"
                      [attr.aria-label]="day.name + ', inicio del bloque'">
                      @for (time of times; track time) {
                        <option [value]="time">{{ time }}</option>
                      }
                    </select>
                  </label>
                  <span aria-hidden="true">a</span>
                  <label>
                    <span class="visually-hidden">Fin</span>
                    <select [ngModel]="item.block.end" (ngModelChange)="setTime(item.index, 'end', $event)"
                      [attr.aria-label]="day.name + ', fin del bloque'">
                      @for (time of times.slice(1); track time) {
                        <option [value]="time">{{ time }}</option>
                      }
                    </select>
                  </label>
                  <button type="button" class="btn btn--ghost" (click)="remove(item.index)">
                    Quitar
                  </button>
                </div>
              } @empty {
                <p class="muted small">No atiendes este día.</p>
              }
              <div>
                <button type="button" class="btn" (click)="add(day.index)" [disabled]="countOf(day.index) >= maxBlocks">
                  Agregar bloque
                </button>
              </div>
            </fieldset>
          }

          @if (problem(); as text) {
            <app-banner tone="warning">{{ text }}</app-banner>
          }
          @if (saveError(); as message) {
            <app-banner tone="danger">{{ message }}</app-banner>
          }
          @if (saved()) {
            <app-banner tone="success">Guardaste tu horario. Aplica desde el {{ effectiveLabel() }}.</app-banner>
          }

          <div class="row">
            <button type="button" class="btn btn--primary" (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : 'Guardar horario' }}
            </button>
          </div>
        </section>

        <section class="card stack">
          <h2>Esta semana</h2>
          <p class="muted small">Así es tu horario que está en curso. No se puede cambiar.</p>
          @if (current().length === 0) {
            <p class="muted small">No tienes horario para esta semana.</p>
          } @else {
            <ul class="plain">
              @for (block of current(); track $index) {
                <li>{{ dayName(block.dayOfWeek) }}: {{ block.start }} a {{ block.end }}</li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
})
export class MyWorkHoursPage {
  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Mi horario de atención' },
  ];
  protected readonly days = DAY_NAMES.map((name, index) => ({ name, index }));
  protected readonly times = timeOptions();
  protected readonly maxBlocks = MAX_BLOCKS_PER_DAY;

  private readonly getMyHours = inject(GetMyWorkHours);
  private readonly saveMyHours = inject(SaveMyWorkHours);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly effectiveFrom = signal('');
  protected readonly current = signal<readonly WorkBlock[]>([]);
  /** The schedule being edited (from next week on). */
  protected readonly blocks = signal<WorkBlock[]>([]);
  protected readonly problem = computed(() => scheduleProblem(this.blocks()));
  protected readonly effectiveLabel = computed(() => longDate(this.effectiveFrom()));

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.applyHours(await this.getMyHours.execute());
    } catch (error) {
      this.loadError.set(describeError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected blocksOf(day: number): { block: WorkBlock; index: number }[] {
    return this.blocks()
      .map((block, index) => ({ block, index }))
      .filter((item) => item.block.dayOfWeek === day)
      .sort((a, b) => a.block.start.localeCompare(b.block.start));
  }

  protected countOf(day: number): number {
    return this.blocksOf(day).length;
  }

  protected add(day: number): void {
    this.saved.set(false);
    this.blocks.update((list) => [...list, { dayOfWeek: day, start: '09:00', end: '10:00' }]);
  }

  protected remove(index: number): void {
    this.saved.set(false);
    this.blocks.update((list) => list.filter((_, position) => position !== index));
  }

  protected setTime(index: number, field: 'start' | 'end', value: string): void {
    this.saved.set(false);
    this.blocks.update((list) =>
      list.map((block, position) => (position === index ? { ...block, [field]: value } : block)),
    );
  }

  protected async save(): Promise<void> {
    this.saveError.set(null);
    this.saved.set(false);
    if (this.problem()) return;
    this.saving.set(true);
    try {
      this.applyHours(await this.saveMyHours.execute(this.blocks()));
      this.saved.set(true);
    } catch (error) {
      this.saveError.set(describeError(error).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected dayName(day: number): string {
    return DAY_NAMES[day] ?? '';
  }

  private applyHours(hours: DoctorHours): void {
    this.effectiveFrom.set(hours.effectiveFrom);
    this.current.set(hours.current);
    this.blocks.set([...hours.next]);
  }
}
