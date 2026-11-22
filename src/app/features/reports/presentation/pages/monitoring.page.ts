import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { formatDate } from '../../../../shared/presentation/format';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { MonitoringStatus, ReplicationDestination, StateCount } from '../../domain/entities/reports';
import { GetMonitoringStatus } from '../../domain/usecases/reports-usecases';
import { DELIVERY_STATES, stateLabel } from '../labels';

/** Count of deliveries in one state for a destination; zero when the state has no rows. */
function countIn(destination: ReplicationDestination, state: string): number {
  return destination.deliveries.find((item: StateCount) => item.state === state)?.total ?? 0;
}

/** Container: shows whether the primary database answers and how far each replica is behind. */
@Component({
  selector: 'app-monitoring-page',
  imports: [BannerComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <div class="stack">
      <app-page-header area="Administración" title="Monitoreo" [crumbs]="crumbs">
        <p lede class="muted">Estado de la base principal y de la replicación hacia los respaldos.</p>
      </app-page-header>

      <section class="card stack">
        <div class="row spread">
          <div>
            <h2>Base principal</h2>
            @if (status(); as data) {
              <p class="muted small">Revisado el {{ formatted(data.checkedAt) }}.</p>
            }
          </div>
          <button class="btn btn--small" type="button" (click)="load()" [disabled]="loading()">Actualizar</button>
        </div>
        @if (loading() && !status()) {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Revisando…</p>
        } @else if (failed(); as view) {
          <app-banner tone="danger">{{ view.message }}</app-banner>
        } @else if (status(); as data) {
          <p>Respuesta de consulta: <strong>{{ data.databaseLatencyMs }} ms</strong></p>
        }
      </section>

      @if (status(); as data) {
        <section class="card stack">
          <h2>Replicación</h2>
          @if (data.destinations.length === 0) {
            <p class="empty">No hay destinos de replicación activos.</p>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Destino</th>
                    <th class="num">Pendientes</th>
                    <th class="num">Error temporal</th>
                    <th class="num">Error permanente</th>
                    <th class="num">Entregados</th>
                    <th>Pendiente más antiguo</th>
                    <th>Última entrega</th>
                  </tr>
                </thead>
                <tbody>
                  @for (destination of data.destinations; track destination.code) {
                    <tr>
                      <td>{{ destination.code }}</td>
                      <td class="num">{{ countIn(destination, 'PENDIENTE') }}</td>
                      <td class="num">{{ countIn(destination, 'ERROR_TEMPORAL') }}</td>
                      <td class="num">{{ countIn(destination, 'ERROR_PERMANENTE') }}</td>
                      <td class="num">{{ countIn(destination, 'ENTREGADO') }}</td>
                      <td>{{ formatted(destination.oldestPendingAt) }}</td>
                      <td>{{ formatted(destination.lastDeliveryAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="muted small">
              Estados: {{ stateNames.PENDIENTE }}, {{ stateNames.ENTREGADO }}, {{ stateNames.ERROR_TEMPORAL }} y
              {{ stateNames.ERROR_PERMANENTE }}. Un destino con pendientes antiguos o errores no está al día.
            </p>
          }
        </section>
      }
    </div>
  `,
})
export class MonitoringPage {
  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Monitoreo' },
  ];
  private readonly getStatus = inject(GetMonitoringStatus);

  protected readonly stateNames = {
    PENDIENTE: stateLabel(DELIVERY_STATES, 'PENDIENTE'),
    ENTREGADO: stateLabel(DELIVERY_STATES, 'ENTREGADO'),
    ERROR_TEMPORAL: stateLabel(DELIVERY_STATES, 'ERROR_TEMPORAL'),
    ERROR_PERMANENTE: stateLabel(DELIVERY_STATES, 'ERROR_PERMANENTE'),
  };

  protected readonly status = signal<MonitoringStatus | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal<ErrorView | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(null);
    try {
      this.status.set(await this.getStatus.execute());
    } catch (error) {
      this.status.set(null);
      this.failed.set(describeError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected countIn(destination: ReplicationDestination, state: string): number {
    return countIn(destination, state);
  }

  protected formatted(iso: string | null): string {
    return iso ? formatDate(iso) : 'Sin datos';
  }
}
