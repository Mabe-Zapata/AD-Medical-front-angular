import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AppError } from '../../../../core/domain/app-error';
import { isUuid } from '../../../../core/domain/dates';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { formatDate } from '../../../../shared/presentation/format';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { PRIORITIES, OrderSummary, Priority } from '../../domain/entities/orders';
import { CreateOrder, ListOrders } from '../../domain/usecases/orders-usecases';
import { ORDER_STATUS_LABELS, PRIORITY_LABELS } from '../labels';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { PageState } from '../../../../shared/presentation/pagination';

/** Container: lists the orders the person may read, opens one by its id, or (for ordering doctors) creates one. */
@Component({
  selector: 'app-orders-page',
  imports: [FormsModule, RouterLink, BannerComponent, ChipComponent, PaginatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <section class="card stack">
        <div>
          <h2>Mis órdenes</h2>
          <p class="muted small">Las más recientes primero. El médico ve las que ordenó.</p>
        </div>
        @if (listing() === 'loading') {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
        } @else if (listing() === 'denied') {
          <p class="muted small">
            Tu rol no ve este listado: abre la orden con el identificador que te dio el médico.
          </p>
        } @else if (listing() === 'failed') {
          <app-banner tone="danger">No pudimos cargar las órdenes.</app-banner>
          <div><button class="btn btn--small" type="button" (click)="reload()">Reintentar</button></div>
        } @else if (orders().length === 0) {
          <p class="empty">Todavía no hay órdenes.</p>
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Identificador</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (order of pager.slice(orders()); track order.id) {
                  <tr>
                    <td>{{ dateOf(order) }}</td>
                    <td>
                      <app-chip [tone]="order.status === 'COMPLETADA' ? 'success' : 'info'">
                        {{ statusLabels[order.status] ?? order.status }}
                      </app-chip>
                    </td>
                    <td class="mono small">{{ order.id }}</td>
                    <td>
                      <a class="btn btn--small" [routerLink]="['/ordenes', order.id]">Abrir</a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
      <app-paginator [total]="orders().length" [state]="pager" />
        }
      </section>

      <section class="card stack">
        <div>
          <h2>Abrir una orden por identificador</h2>
          <p class="muted small">Para el laboratorista, que no ve el listado, o para una orden concreta.</p>
        </div>
        <form class="row" (ngSubmit)="open()" novalidate>
          <div class="field grow">
            <label for="order-id">Identificador de la orden</label>
            <input
              id="order-id"
              class="input mono"
              name="orderId"
              [ngModel]="orderId()"
              (ngModelChange)="orderId.set($event); openError.set(false)"
              placeholder="00000000-0000-0000-0000-000000000000"
              autocomplete="off"
            />
            @if (openError()) {
              <span class="field-error">Escribe un identificador válido (formato UUID).</span>
            }
          </div>
          <button class="btn btn--primary align" type="submit">Abrir</button>
        </form>
      </section>

      @if (canCreate) {
        <section class="card stack">
          <div>
            <h2>Crear una orden</h2>
            <p class="muted small">
              Solo el médico que ordena. Usa los identificadores (UUID) del paciente y de las
              pruebas; el sistema todavía no ofrece un catálogo para elegirlos por nombre.
            </p>
          </div>
          @if (error(); as e) {
            <app-banner tone="danger">
              {{ e.message }}
            </app-banner>
          }
          <form class="stack" (ngSubmit)="create()" novalidate>
            <div class="field">
              <label for="patient-id">Identificador del paciente</label>
              <input
                id="patient-id"
                class="input mono"
                name="patientId"
                [ngModel]="patientId()"
                (ngModelChange)="patientId.set($event)"
                autocomplete="off"
              />
            </div>
            <div class="field">
              <label for="test-ids">Identificadores de las pruebas (uno por línea)</label>
              <textarea
                id="test-ids"
                class="input mono"
                rows="3"
                name="testIds"
                [ngModel]="testIds()"
                (ngModelChange)="testIds.set($event)"
              ></textarea>
            </div>
            <div class="grid-2">
              <div class="field">
                <label for="priority">Prioridad</label>
                <select
                  id="priority"
                  class="input"
                  name="priority"
                  [ngModel]="priority()"
                  (ngModelChange)="priority.set($event)"
                >
                  @for (option of priorities; track option) {
                    <option [value]="option">{{ priorityLabels[option] }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label for="notes">Observaciones (opcional)</label>
                <input
                  id="notes"
                  class="input"
                  name="notes"
                  maxlength="1000"
                  [ngModel]="notes()"
                  (ngModelChange)="notes.set($event)"
                />
              </div>
            </div>
            <div>
              <button class="btn btn--primary" type="submit" [disabled]="saving()">
                @if (saving()) {
                  <span class="spinner" aria-hidden="true"></span> Creando…
                } @else {
                  Crear orden
                }
              </button>
            </div>
          </form>
        </section>
      }
    </div>
  `,
  styles: `
    .grow {
      flex: 1 1 320px;
    }
    .align {
      align-self: flex-end;
    }
  `,
})
export class OrdersPage {
  protected readonly pager = new PageState();
  private readonly router = inject(Router);
  private readonly createOrder = inject(CreateOrder);
  private readonly listOrders = inject(ListOrders);

  protected readonly canCreate = inject(SessionState).can(PERMISSIONS.ordersCreate);
  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  protected readonly orders = signal<readonly OrderSummary[]>([]);
  protected readonly listing = signal<'loading' | 'ready' | 'denied' | 'failed'>('loading');

  protected readonly orderId = signal('');
  protected readonly openError = signal(false);
  protected readonly patientId = signal('');
  protected readonly testIds = signal('');
  protected readonly priority = signal<Priority>('NORMAL');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<ErrorView | null>(null);

  constructor() {
    void this.load();
  }

  protected dateOf(order: OrderSummary): string {
    return formatDate(order.orderedAt);
  }

  protected reload(): void {
    this.listing.set('loading');
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.orders.set(await this.listOrders.execute());
      this.listing.set('ready');
    } catch (error) {
      // 403: this role does not read orders (the lab technician), which is not a failure.
      this.listing.set(error instanceof AppError && error.kind === 'forbidden' ? 'denied' : 'failed');
    }
  }

  protected async open(): Promise<void> {
    const id = this.orderId().trim();
    if (!isUuid(id)) {
      this.openError.set(true);
      return;
    }
    await this.router.navigate(['/ordenes', id]);
  }

  protected async create(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const order = await this.createOrder.execute({
        patientId: this.patientId(),
        testTypeIds: this.testIds()
          .split(/[\s,]+/)
          .filter((id) => id.length > 0),
        priority: this.priority(),
        notes: this.notes(),
      });
      await this.router.navigate(['/ordenes', order.id]);
    } catch (error) {
      this.error.set(
        describeError(error, {
          validation: 'Revisa los identificadores: deben ser UUID válidos, uno por línea.',
          forbidden: 'Solo un médico con perfil profesional puede crear órdenes.',
          not_found: 'No encontramos a ese paciente.',
        }),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
