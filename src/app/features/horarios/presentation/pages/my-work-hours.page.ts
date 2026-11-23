import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { describeError } from '../../../../shared/presentation/error-message';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { DAY_NAMES, DoctorHours, WorkBlock } from '../../domain/entities/work-hours';
import {
  CLINIC_CLOSES,
  CLINIC_OPENS,
  MAX_BLOCKS_PER_DAY,
  blockIssues,
  scheduleProblem,
  timeOptions,
  toMinutes,
} from '../../domain/policies/work-hours-policy';
import { GetMyWorkHours, SaveMyWorkHours } from '../../domain/usecases/work-hours-usecases';

/** Long date for the first week the change applies to, in Spanish. */
function longDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Hours of work in a day, as a short label such as "3 h 30 min". */
function durationLabel(blocks: readonly WorkBlock[]): string {
  const minutes = blocks.reduce((total, block) => total + toMinutes(block.end) - toMinutes(block.start), 0);
  if (minutes === 0) return 'Sin atención';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Container: the doctor sets the hours they work each week. A change applies from next week on. */
@Component({
  selector: 'app-my-work-hours-page',
  imports: [FormsModule, BannerComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .hours-layout {
      align-items: start;
      display: grid;
      gap: 24px;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    }
    @media (max-width: 900px) {
      .hours-layout {
        grid-template-columns: 1fr;
      }
    }
    .intro {
      margin: 0;
    }
    .day-list {
      display: grid;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .day-row {
      border-top: 1px solid var(--blue-soft);
      display: grid;
      gap: 12px 20px;
      grid-template-columns: 170px minmax(0, 1fr);
      padding: 16px 0;
    }
    .day-row:first-child {
      border-top: 0;
      padding-top: 4px;
    }
    .day-name {
      font-weight: 800;
      padding-top: 10px;
    }
    .day-name small {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
    }
    .day-blocks {
      display: grid;
      gap: 10px;
      justify-items: start;
    }
    .block-row {
      align-items: end;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .block-row .field {
      min-width: 130px;
    }
    .block-row .btn {
      margin-bottom: 1px;
    }
    .block-wrap {
      display: grid;
      gap: 4px;
    }
    .block-separator {
      color: var(--muted);
      padding-bottom: 12px;
    }
    .summary {
      display: grid;
      gap: 14px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .summary li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px dashed var(--blue-soft);
      padding-bottom: 10px;
    }
    .summary li:last-child {
      border-bottom: 0;
    }
    .summary-times {
      font-size: 13px;
      color: var(--muted);
      text-align: right;
    }
    @media (max-width: 600px) {
      .day-row {
        grid-template-columns: 1fr;
      }
      .day-name {
        padding-top: 0;
      }
    }
  `,
  template: `
    <div class="stack">
      <app-page-header area="Médico" title="Mi horario de atención" [crumbs]="crumbs">
        <p lede class="muted">
          Marca los días y las horas en que atiendes. El administrador usará este horario para crear tus citas.
        </p>
      </app-page-header>

      @if (loading()) {
        <section class="card">
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando tu horario…</p>
        </section>
      } @else if (loadError(); as message) {
        <section class="card stack">
          <app-banner tone="danger">{{ message }}</app-banner>
          <div class="row"><button type="button" class="btn" (click)="load()">Reintentar</button></div>
        </section>
      } @else {
        <div class="hours-layout">
          <section class="card stack">
            <div class="stack" style="gap: 6px">
              <h2>Horario que vas a tener</h2>
              <p class="muted small intro">
                Aplica desde el <strong>{{ effectiveLabel() }}</strong>. La semana en curso y las ya planificadas no cambian.
              </p>
              <p class="muted small intro">
                Toma de muestras de 08:00 a 10:00 · consultas de 12:00 a 17:00 · bloques de 15 minutos.
              </p>
            </div>

            <ul class="day-list">
              @for (day of days; track day.index) {
                <li class="day-row">
                  <div class="day-name">
                    {{ day.name }}
                    <small>{{ hoursOf(day.index) }}</small>
                  </div>

                  <div class="day-blocks">
                    @for (item of blocksOf(day.index); track item.index) {
                      <div class="block-wrap">
                      <div class="block-row">
                        <div class="field">
                          <label [attr.for]="'start-' + item.index">Desde</label>
                          <select
                            class="input"
                            [attr.id]="'start-' + item.index"
                            [ngModel]="item.block.start"
                            (ngModelChange)="setTime(item.index, 'start', $event)"
                          >
                            @for (time of times; track time) {
                              <option [value]="time">{{ time }}</option>
                            }
                          </select>
                        </div>
                        <span class="block-separator" aria-hidden="true">a</span>
                        <div class="field">
                          <label [attr.for]="'end-' + item.index">Hasta</label>
                          <select
                            class="input"
                            [attr.id]="'end-' + item.index"
                            [ngModel]="item.block.end"
                            (ngModelChange)="setTime(item.index, 'end', $event)"
                          >
                            @for (time of endTimes; track time) {
                              <option [value]="time">{{ time }}</option>
                            }
                          </select>
                        </div>
                        <button type="button" class="btn btn--small btn--ghost" (click)="remove(item.index)">
                          Quitar
                        </button>
                      </div>
                      @if (issues()[item.index]; as text) {
                        <span class="field-error" role="alert">{{ text }}</span>
                      }
                      </div>
                    } @empty {
                      <span class="muted small">No atiendes este día.</span>
                    }

                    <div class="row">
                      @if (countOf(day.index) < maxBlocks) {
                        <button type="button" class="btn btn--small" (click)="add(day.index)">
                          + Agregar bloque
                        </button>
                      }
                      @if (countOf(day.index) > 0) {
                        <button type="button" class="btn btn--small btn--ghost" (click)="copyToAll(day.index)">
                          Copiar este día a toda la semana
                        </button>
                      }
                    </div>
                  </div>
                </li>
              }
            </ul>

            @if (problem()) {
              <p class="field-error" role="status">Corrige los bloques marcados para poder guardar.</p>
            }
            @if (saveError(); as message) {
              <app-banner tone="danger">{{ message }}</app-banner>
            }
            @if (saved()) {
              <app-banner tone="success">Horario guardado. Aplica desde el {{ effectiveLabel() }}.</app-banner>
            }

            <div class="row">
              <button type="button" class="btn btn--primary" (click)="save()" [disabled]="saving() || !!problem()">
                {{ saving() ? 'Guardando…' : 'Guardar horario' }}
              </button>
              <button type="button" class="btn btn--ghost" (click)="discard()" [disabled]="saving()">
                Descartar cambios
              </button>
            </div>
          </section>

          <aside class="card stack">
            <h2>Esta semana</h2>
            <p class="muted small">Tu horario vigente. Lo ves para tu referencia; no se puede cambiar.</p>
            @if (current().length === 0) {
              <p class="muted small">No tienes horario para esta semana.</p>
            } @else {
              <ul class="summary">
                @for (day of days; track day.index) {
                  @if (currentOf(day.index).length > 0) {
                    <li>
                      <strong>{{ day.name }}</strong>
                      <span class="summary-times">
                        @for (block of currentOf(day.index); track $index) {
                          <span>{{ block.start }} a {{ block.end }}</span><br />
                        }
                      </span>
                    </li>
                  }
                }
              </ul>
            }
          </aside>
        </div>
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
  protected readonly endTimes = this.times.slice(1);
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
  /** The schedule as the server has it, to discard edits back to. */
  private savedBlocks: readonly WorkBlock[] = [];
  protected readonly problem = computed(() => scheduleProblem(this.blocks()));
  /** One message per block, shown next to the block that has it. */
  protected readonly issues = computed(() => blockIssues(this.blocks()));
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

  protected hoursOf(day: number): string {
    return durationLabel(this.blocksOf(day).map((item) => item.block));
  }

  protected currentOf(day: number): WorkBlock[] {
    return this.current().filter((block) => block.dayOfWeek === day);
  }

  protected countOf(day: number): number {
    return this.blocksOf(day).length;
  }

  protected add(day: number): void {
    this.saved.set(false);
    const existing = this.blocksOf(day).map((item) => item.block);
    // Start the new block after the last one of the day, inside the clinic hours.
    const lastEnd = existing.reduce((latest, block) => Math.max(latest, toMinutes(block.end)), toMinutes(CLINIC_OPENS));
    const start = Math.min(lastEnd, toMinutes(CLINIC_CLOSES) - 60);
    const hh = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    this.blocks.update((list) => [...list, { dayOfWeek: day, start: hh(start), end: hh(start + 60) }]);
  }

  /** Copies one day's blocks onto every day of the week, replacing what those days had. */
  protected copyToAll(day: number): void {
    const source = this.blocksOf(day).map((item) => item.block);
    this.saved.set(false);
    this.blocks.set(
      this.days.flatMap((target) =>
        target.index === day ? source : source.map((block) => ({ ...block, dayOfWeek: target.index })),
      ),
    );
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

  protected discard(): void {
    this.saved.set(false);
    this.saveError.set(null);
    this.blocks.set([...this.savedBlocks]);
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

  private applyHours(hours: DoctorHours): void {
    this.effectiveFrom.set(hours.effectiveFrom);
    this.current.set(hours.current);
    this.savedBlocks = [...hours.next];
    this.blocks.set([...hours.next]);
  }
}
