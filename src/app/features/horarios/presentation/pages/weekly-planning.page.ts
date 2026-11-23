import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { formatBranchDate, formatBranchTimeRange } from '../../../../core/time/branch-time';
import { describeError } from '../../../../shared/presentation/error-message';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { PageState } from '../../../../shared/presentation/pagination';
import {
  Consultorio,
  DAY_NAMES,
  DoctorHours,
  DoctorOption,
  GenerationResult,
  ProposedSlot,
  WorkBlock,
} from '../../domain/entities/work-hours';
import { mondayOf, weekProblem } from '../../domain/policies/work-hours-policy';
import {
  GenerateWeek,
  GetDoctorWorkHours,
  ListConsultorios,
  ListDoctors,
  ProposeWeek,
} from '../../domain/usecases/work-hours-usecases';

const WINDOW_NAMES: Record<ProposedSlot['window'], string> = {
  MANANA: 'Toma de muestras (mañana)',
  TARDE: 'Consultas (tarde)',
};

/** Container: the administrator plans one week of one-hour slots from each doctor's hours. */
@Component({
  selector: 'app-weekly-planning-page',
  imports: [FormsModule, BannerComponent, PageHeaderComponent, PaginatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .grid-form {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .grid-2 label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
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
      <app-page-header area="Administración" title="Planificación semanal" [crumbs]="crumbs">
        <p lede class="muted">
          Crea las citas de una semana a partir del horario que declaró cada médico. Antes de generar,
          revisa la propuesta.
        </p>
      </app-page-header>

      <section class="card stack">
        <h2>1. Elige médico y semana</h2>
        @if (listError(); as message) {
          <app-banner tone="danger">{{ message }}</app-banner>
        }
        <div class="grid-2">
          <label>
            Médico
            <select class="input" [ngModel]="doctorId()" (ngModelChange)="chooseDoctor($event)">
              <option value="">Elige un médico</option>
              @for (doctor of doctors(); track doctor.id) {
                <option [value]="doctor.id">{{ doctor.name }}</option>
              }
            </select>
          </label>
          <label>
            Semana (lunes)
            <input class="input" type="date" [ngModel]="week()" (ngModelChange)="chooseWeek($event)" />
          </label>
          <label>
            Consultorio
            <select class="input" [ngModel]="consultorioId()" (ngModelChange)="consultorioId.set($event)">
              <option value="">Elige un consultorio</option>
              @for (office of offices(); track office.id) {
                <option [value]="office.id">{{ office.office }} · {{ office.name }}</option>
              }
            </select>
          </label>
        </div>
        @if (weekIssue(); as text) {
          <app-banner tone="warning">{{ text }}</app-banner>
        }
      </section>

      @if (hours(); as declared) {
        <section class="card stack">
          <h2>Horario declarado por el médico</h2>
          <p class="muted small">Desde el {{ dateLabel(declared.effectiveFrom) }} aplica el horario que sigue.</p>
          <div class="hours">
            <div>
              <h3>Esta semana</h3>
              {{ describe(declared.current) }}
            </div>
            <div>
              <h3>Próxima semana en adelante</h3>
              {{ describe(declared.next) }}
            </div>
          </div>
        </section>
      }

      <section class="card stack">
        <h2>2. Revisa la propuesta</h2>
        <div class="row">
          <button type="button" class="btn btn--dark" (click)="preview()" [disabled]="!canPreview() || previewing()">
            {{ previewing() ? 'Calculando…' : 'Ver propuesta' }}
          </button>
        </div>
        @if (previewError(); as message) {
          <app-banner tone="danger">{{ message }}</app-banner>
        }
        @if (proposal(); as slots) {
          @if (slots.length === 0) {
            <p class="muted">Esa semana no tiene horas de atención para este médico. No se creará nada.</p>
          } @else {
            <p class="muted small">
              {{ slots.length }} horarios de una hora: {{ countOf('MANANA') }} de toma de muestras y
              {{ countOf('TARDE') }} de consultas.
            </p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Día</th>
                    <th scope="col">Hora</th>
                    <th scope="col">Atiende</th>
                  </tr>
                </thead>
                <tbody>
                  @for (slot of pagedSlots(); track slot.startUtc) {
                    <tr>
                      <td>{{ dayOf(slot.startUtc) }}</td>
                      <td>{{ timeOf(slot) }}</td>
                      <td>{{ windowName(slot.window) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <app-paginator [total]="slots.length" [state]="pager" />
          }
        }
      </section>

      @if (proposal()?.length) {
        <section class="card stack">
          <h2>3. Generar la semana</h2>
          @if (!consultorioId()) {
            <p class="muted small">Elige el consultorio para poder generar.</p>
          }
          @if (generating()) {
            <p class="muted"><span class="spinner" aria-hidden="true"></span> Creando horarios…</p>
          }
          @if (generateError(); as message) {
            <app-banner tone="danger">{{ message }}</app-banner>
          }
          @if (result(); as done) {
            <app-banner tone="success">
              Se crearon {{ done.created }} horarios. {{ done.existing }} ya existían y no se repitieron.
            </app-banner>
          }
          @if (!confirming()) {
            <div class="row">
              <button type="button" class="btn btn--primary" (click)="confirming.set(true)" [disabled]="!consultorioId() || generating()">
                Generar semana
              </button>
            </div>
          } @else {
            <app-banner tone="warning">
              Se crearán los horarios de la propuesta en {{ consultorioLabel() }}. Los horarios que ya existen no se duplican.
            </app-banner>
            <div class="row">
              <button type="button" class="btn btn--primary" (click)="generate()" [disabled]="generating()">
                Sí, generar
              </button>
              <button type="button" class="btn btn--ghost" (click)="confirming.set(false)">Cancelar</button>
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class WeeklyPlanningPage {
  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Planificación semanal' },
  ];
  protected readonly pager = new PageState();

  private readonly listDoctors = inject(ListDoctors);
  private readonly listConsultorios = inject(ListConsultorios);
  private readonly getDoctorHours = inject(GetDoctorWorkHours);
  private readonly proposeWeek = inject(ProposeWeek);
  private readonly generateWeek = inject(GenerateWeek);

  protected readonly doctors = signal<DoctorOption[]>([]);
  protected readonly offices = signal<Consultorio[]>([]);
  protected readonly listError = signal<string | null>(null);

  protected readonly doctorId = signal('');
  protected readonly week = signal(mondayOf(new Date()));
  protected readonly consultorioId = signal('');
  protected readonly hours = signal<DoctorHours | null>(null);

  protected readonly previewing = signal(false);
  protected readonly previewError = signal<string | null>(null);
  protected readonly proposal = signal<ProposedSlot[] | null>(null);

  protected readonly confirming = signal(false);
  protected readonly generating = signal(false);
  protected readonly generateError = signal<string | null>(null);
  protected readonly result = signal<GenerationResult | null>(null);

  protected readonly weekIssue = computed(() => weekProblem(this.week()));
  protected readonly canPreview = computed(() => !!this.doctorId() && !this.weekIssue());
  protected readonly consultorioLabel = computed(() => {
    const office = this.offices().find((item) => item.id === this.consultorioId());
    return office ? `${office.office} · ${office.name}` : 'el consultorio elegido';
  });
  protected readonly pagedSlots = computed(() => this.pager.slice(this.proposal() ?? []));

  constructor() {
    void this.loadLists();
  }

  protected async loadLists(): Promise<void> {
    this.listError.set(null);
    try {
      const [doctors, offices] = await Promise.all([this.listDoctors.execute(), this.listConsultorios.execute()]);
      this.doctors.set(doctors);
      this.offices.set(offices);
    } catch (error) {
      this.listError.set(describeError(error).message);
    }
  }

  protected async chooseDoctor(id: string): Promise<void> {
    this.doctorId.set(id);
    this.resetProposal();
    this.hours.set(null);
    if (!id) return;
    try {
      this.hours.set(await this.getDoctorHours.execute(id));
    } catch (error) {
      this.previewError.set(describeError(error).message);
    }
  }

  protected chooseWeek(value: string): void {
    this.week.set(value);
    this.resetProposal();
  }

  protected async preview(): Promise<void> {
    this.previewing.set(true);
    this.previewError.set(null);
    this.result.set(null);
    this.confirming.set(false);
    try {
      this.proposal.set(await this.proposeWeek.execute(this.doctorId(), this.week()));
      this.pager.page.set(0);
    } catch (error) {
      this.proposal.set(null);
      this.previewError.set(describeError(error).message);
    } finally {
      this.previewing.set(false);
    }
  }

  protected async generate(): Promise<void> {
    this.generating.set(true);
    this.generateError.set(null);
    try {
      this.result.set(await this.generateWeek.execute(this.doctorId(), this.consultorioId(), this.week()));
      this.confirming.set(false);
    } catch (error) {
      this.generateError.set(describeError(error).message);
    } finally {
      this.generating.set(false);
    }
  }

  protected countOf(window: ProposedSlot['window']): number {
    return (this.proposal() ?? []).filter((slot) => slot.window === window).length;
  }

  protected windowName(window: ProposedSlot['window']): string {
    return WINDOW_NAMES[window];
  }

  protected dayOf(startUtc: string): string {
    return formatBranchDate(startUtc);
  }

  protected timeOf(slot: ProposedSlot): string {
    return formatBranchTimeRange(slot.startUtc, slot.endUtc);
  }

  protected dateLabel(isoDate: string): string {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-EC', { day: 'numeric', month: 'long' });
  }

  protected describe(blocks: readonly WorkBlock[]): string {
    if (blocks.length === 0) return 'Sin horas de atención.';
    return blocks
      .map((block) => `${DAY_NAMES[block.dayOfWeek]} ${block.start} a ${block.end}`)
      .join(' · ');
  }

  private resetProposal(): void {
    this.proposal.set(null);
    this.previewError.set(null);
    this.result.set(null);
    this.confirming.set(false);
  }
}
