import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { toIsoDate } from '../../../../core/domain/dates';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { ReportSummary, StateCount } from '../../domain/entities/reports';
import { MAX_PERIOD_DAYS, PeriodProblem, periodProblem } from '../../domain/policies/reports-policies';
import { GetReportSummary } from '../../domain/usecases/reports-usecases';
import {
  APPOINTMENT_STATES,
  LAB_ORDER_STATES,
  PAYMENT_STATES,
  TREATMENT_STATES,
  stateLabel,
} from '../labels';

const PERIOD_MESSAGES: Readonly<Record<PeriodProblem, string>> = {
  missing: 'Indica las dos fechas del periodo.',
  format: 'Las fechas deben tener el formato AAAA-MM-DD.',
  order: 'La fecha inicial debe ser anterior o igual a la final.',
  'too-long': `El periodo no puede durar más de ${MAX_PERIOD_DAYS} días.`,
};

/** Money is summed in cents so that the total never drifts by a float rounding error. */
function centsOf(amount: string): number {
  return Math.round(Number(amount) * 100);
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function firstDayOfMonth(today: Date): string {
  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
}

/** Container: an administrator picks a period and reads the figures of the laboratory in it. */
@Component({
  selector: 'app-reports-page',
  imports: [FormsModule, BannerComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .period {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
    }
    .period label {
      display: grid;
      gap: 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <div class="stack">
      <app-page-header area="Administración" title="Reportes" [crumbs]="crumbs">
        <p lede class="muted">Cifras del laboratorio en un periodo. Solo lectura: no cambia ningún dato.</p>
      </app-page-header>

      <section class="card stack">
        <form class="period" (ngSubmit)="load()">
          <label>
            <span>Desde</span>
            <input type="date" name="from" [ngModel]="from()" (ngModelChange)="from.set($event)" required />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" name="to" [ngModel]="to()" (ngModelChange)="to.set($event)" required />
          </label>
          <button class="btn btn--primary" type="submit" [disabled]="status() === 'loading'">
            Consultar
          </button>
        </form>
        @if (problem(); as text) {
          <app-banner tone="warning">{{ text }}</app-banner>
        }
        @if (status() === 'loading') {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando cifras…</p>
        } @else if (status() === 'failed' && error(); as view) {
          <app-banner tone="danger">{{ view.message }}</app-banner>
        }
      </section>

      @if (summary(); as data) {
        <p class="muted small">Periodo del {{ data.from }} al {{ data.to }}, ambos incluidos.</p>
        <div class="grid">
          <section class="card stack">
            <h2>Citas</h2>
            @if (data.appointments.length === 0) {
              <p class="empty">Sin citas en el periodo.</p>
            } @else {
              <table class="table">
                <thead><tr><th>Estado</th><th class="num">Total</th></tr></thead>
                <tbody>
                  @for (row of data.appointments; track row.state) {
                    <tr><td>{{ label(appointmentNames, row) }}</td><td class="num">{{ row.total }}</td></tr>
                  }
                </tbody>
              </table>
            }
          </section>

          <section class="card stack">
            <h2>Órdenes de laboratorio</h2>
            @if (data.labOrders.length === 0) {
              <p class="empty">Sin órdenes en el periodo.</p>
            } @else {
              <table class="table">
                <thead><tr><th>Estado</th><th class="num">Total</th></tr></thead>
                <tbody>
                  @for (row of data.labOrders; track row.state) {
                    <tr><td>{{ label(orderNames, row) }}</td><td class="num">{{ row.total }}</td></tr>
                  }
                </tbody>
              </table>
            }
          </section>

          <section class="card stack">
            <h2>Pagos</h2>
            @if (data.payments.length === 0) {
              <p class="empty">Sin pagos en el periodo.</p>
            } @else {
              <table class="table">
                <thead><tr><th>Estado</th><th class="num">Total</th><th class="num">Monto (USD)</th></tr></thead>
                <tbody>
                  @for (row of data.payments; track row.state) {
                    <tr>
                      <td>{{ paymentLabel(row.state) }}</td>
                      <td class="num">{{ row.total }}</td>
                      <td class="num">{{ row.amount }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr><th>Total cobrado y pendiente</th><td class="num">{{ paymentCount() }}</td><td class="num">{{ paymentAmount() }}</td></tr>
                </tfoot>
              </table>
            }
          </section>

          <section class="card stack">
            <h2>Tratamientos</h2>
            @if (data.treatments.length === 0) {
              <p class="empty">Sin tratamientos iniciados en el periodo.</p>
            } @else {
              <table class="table">
                <thead><tr><th>Estado</th><th class="num">Total</th></tr></thead>
                <tbody>
                  @for (row of data.treatments; track row.state) {
                    <tr><td>{{ label(treatmentNames, row) }}</td><td class="num">{{ row.total }}</td></tr>
                  }
                </tbody>
              </table>
            }
          </section>
        </div>
      }
    </div>
  `,
})
export class ReportsPage {
  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Reportes' },
  ];
  private readonly getSummary = inject(GetReportSummary);

  protected readonly appointmentNames = APPOINTMENT_STATES;
  protected readonly orderNames = LAB_ORDER_STATES;
  protected readonly treatmentNames = TREATMENT_STATES;

  protected readonly from = signal(firstDayOfMonth(new Date()));
  protected readonly to = signal(toIsoDate(new Date()));
  protected readonly summary = signal<ReportSummary | null>(null);
  protected readonly status = signal<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  protected readonly problem = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  protected readonly paymentCount = computed(() =>
    (this.summary()?.payments ?? []).reduce((sum, row) => sum + row.total, 0),
  );
  protected readonly paymentAmount = computed(() =>
    formatCents((this.summary()?.payments ?? []).reduce((sum, row) => sum + centsOf(row.amount), 0)),
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const problem = periodProblem(this.from(), this.to());
    if (problem) {
      this.problem.set(PERIOD_MESSAGES[problem]);
      return;
    }
    this.problem.set(null);
    this.status.set('loading');
    this.error.set(null);
    try {
      this.summary.set(await this.getSummary.execute(this.from(), this.to()));
      this.status.set('ready');
    } catch (error) {
      this.summary.set(null);
      this.error.set(describeError(error));
      this.status.set('failed');
    }
  }

  protected label(names: Readonly<Record<string, string>>, row: StateCount): string {
    return stateLabel(names, row.state);
  }

  protected paymentLabel(state: string): string {
    return stateLabel(PAYMENT_STATES, state);
  }
}
