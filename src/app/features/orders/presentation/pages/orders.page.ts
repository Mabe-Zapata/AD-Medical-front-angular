import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { sanitizeFreeText, sanitizeIdentifier, sanitizeSearch, stripEmoji } from '../../../../core/domain/text';
import { sanitizeInputEvent } from '../../../../shared/presentation/forms/sanitize-on-type';
import { AppError } from '../../../../core/domain/app-error';
import { isUuid } from '../../../../core/domain/dates';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { DialogAction, DialogComponent } from '../../../../shared/presentation/organisms/dialog';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { formatDate } from '../../../../shared/presentation/format';
import { ModalComponent } from '../../../../shared/presentation/organisms/modal';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { PRIORITIES, OrderSummary, PatientOption, Priority, TestTypeOption, WorklistOrder } from '../../domain/entities/orders';
import { CreateOrder, ListOrders, ListPatients, ListTestTypes, ListWorklist, ConfirmOrder } from '../../domain/usecases/orders-usecases';
import { PatientPickerComponent } from '../widgets/patient-picker';
import { ORDER_STATUS_LABELS, PRIORITY_LABELS } from '../labels';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { PageState } from '../../../../shared/presentation/pagination';

type QueueFilter = 'todas' | 'urgentes' | 'paciente';

/** Container: lists the orders the person may read, opens one by its id, or (for ordering doctors) creates one. */
@Component({
  selector: 'app-orders-page',
  imports: [FormsModule, RouterLink, BannerComponent, DialogComponent, PageHeaderComponent, ChipComponent, ModalComponent, PaginatorComponent, PatientPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <app-page-header area="Órdenes y resultados" title="Órdenes y resultados" [crumbs]="crumbs">
        <p lede class="muted">
          @if (listing() === 'denied') {
            Abre una orden para registrar sus resultados y subir el informe PDF.
          } @else {
            Registrar resultados, subir informes PDF y revisar propuestas.
          }
        </p>
      </app-page-header>
      @if (listing() !== 'denied') {
      <section class="card stack">
        <div>
          <h2>Mis órdenes</h2>
          <p class="muted small">Las más recientes primero. El médico ve las que ordenó.</p>
        </div>
        @if (listing() === 'loading') {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
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
                  <th>Paciente</th>
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
                      <strong>{{ patientName(order.patientId) }}</strong>
                    </td>
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
      }

      @if (canRecord && listing() === 'denied') {
        <section class="card stack">
          @if (confirmTarget(); as target) {
            <app-dialog
              title="Confirmar la orden"
              message="Al confirmar, la orden queda cerrada: no podrás cambiar resultados ni subir informes. Si hay un informe, se envía al paciente con sus resultados."
              [actions]="confirmActions"
              dismissValue="cancel"
              (chosen)="onConfirmChoice($event, target)"
            />
          }
          <div>
            <h2>Cola de trabajo</h2>
            <p class="muted small">Urgentes primero, luego las más antiguas. Elige una orden para registrar sus resultados.</p>
          </div>
          @if (savedNotice()) {
            <app-banner tone="success">Resultados registrados. Esta es tu cola actualizada.</app-banner>
          }
          @if (queueBanner(); as banner) {
            <app-banner [tone]="banner.tone">{{ banner.text }}</app-banner>
          }
          @if (worklistState() === 'failed') {
            <app-banner tone="danger">No pudimos cargar la cola de trabajo.</app-banner>
            <div><button class="btn btn--small" type="button" (click)="reloadWorklist()">Reintentar</button></div>
          } @else if (worklistState() === 'loading') {
            <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
          } @else {
            <div class="row" role="group" aria-label="Filtrar la cola">
              @for (filter of queueFilters; track filter.key) {
                <button
                  class="btn btn--small"
                  type="button"
                  [class.btn--primary]="queueFilter() === filter.key"
                  [attr.aria-pressed]="queueFilter() === filter.key"
                  (click)="setQueueFilter(filter.key)"
                >
                  {{ filter.label }} ({{ countFor(filter.key) }})
                </button>
              }
            </div>
            @if (queueVisible().length === 0) {
              <p class="empty">
                {{ worklist().length === 0 ? 'No hay órdenes pendientes por ahora.' : 'No hay órdenes en este filtro.' }}
              </p>
            } @else {
              <ul class="queue">
                @for (item of queuePager.slice(queueVisible()); track item.id) {
                  <li class="queue-item">
                    <div class="queue-info">
                      <div class="row">
                        @if (item.priority === 'URGENTE') {
                          <app-chip tone="danger">Urgente</app-chip>
                        }
                        <app-chip tone="info">{{ originLabel(item.origin) }}</app-chip>
                        <span class="muted small">{{ queueDate(item) }}</span>
                      </div>
                      <strong>{{ item.patientName ?? 'Paciente sin nombre registrado' }}</strong>
                      <span>{{ testNames(item) }}</span>
                      @if (item.status === 'COMPLETADA') {
                        <app-chip tone="success">Lista para confirmar</app-chip>
                      }
                      <span class="muted small mono">
                        Orden {{ shortId(item.id) }} · {{ pendingCount(item) }} pendiente(s)
                      </span>
                    </div>
                    @if (item.status === 'COMPLETADA') {
                      <button class="btn btn--primary" type="button" (click)="askConfirm(item)">
                        Confirmar orden
                      </button>
                    } @else {
                      <button class="btn btn--primary" type="button" (click)="openFromWorklist(item)">
                        Registrar resultados
                      </button>
                    }
                  </li>
                }
              </ul>
              <app-paginator [total]="queueVisible().length" [state]="queuePager" />
            }
          }
        </section>
      } @else {
      <section class="card stack">
        <div>
          <h2>Abrir una orden</h2>
          <p class="muted small">
            @if (listing() === 'denied') {
              El médico te da el identificador de la orden en la que registras los resultados.
            } @else {
              Selecciona una orden de la lista, busca por paciente o ingresa el identificador.
            }
          </p>
        </div>

        <form class="approval-form stack" (ngSubmit)="open()" novalidate>
          @if (orderMode() === 'select' && orders().length > 0) {
            <div class="field">
              <label for="order-search">
                <strong>Buscar por paciente o identificador:</strong>
              </label>
              <div class="input-row">
                <input
                  id="order-search"
                  name="orderSearch"
                  class="input"
                  type="text"
                  placeholder="ej. María Pérez o 3b9f2a52..."
                  [ngModel]="orderSearchTerm()"
                  (ngModelChange)="onOrderSearchTermChange($event)"
                  (input)="cleanSearchInput($event)"
                  autocomplete="off"
                />
                @if (orderSearchTerm()) {
                  <button
                    type="button"
                    class="btn btn--small"
                    (click)="clearOrderSearch()"
                    title="Borrar filtro de búsqueda"
                  >
                    Borrar
                  </button>
                }
              </div>
              @if (orderSearchTerm().trim(); as term) {
                <p class="muted small">
                  Filtrando órdenes por <em>"{{ term }}"</em> ({{ filteredOrders().length }} encontrada{{ filteredOrders().length === 1 ? '' : 's' }}).
                </p>
              }
            </div>

            <div class="field">
              <label for="order-select">
                <strong>Seleccionar orden médica:</strong>
              </label>
              <select
                id="order-select"
                class="input"
                name="selectedOrder"
                [ngModel]="selectedOrderOption()"
                (ngModelChange)="onOrderSelectChange($event)"
              >
                @if (filteredOrders().length === 0) {
                  <option value="">-- No hay órdenes que coincidan con la búsqueda --</option>
                } @else {
                  <option value="">-- Selecciona una orden médica --</option>
                  @for (order of filteredOrders(); track order.id) {
                    <option [value]="order.id">
                      {{ dateOf(order) }} — {{ patientName(order.patientId) }} · {{ statusLabels[order.status] ?? order.status }} ({{ order.id.slice(0, 8) }})
                    </option>
                  }
                }
              </select>
            </div>

            @if (selectedOrder(); as ord) {
              <div class="appointment-summary-box">
                <p class="small" style="margin: 0; line-height: 1.6;">
                  <strong>Paciente:</strong> {{ patientName(ord.patientId) }}<br />
                  <strong>Fecha:</strong> {{ dateOf(ord) }} · <strong>Estado:</strong> {{ statusLabels[ord.status] ?? ord.status }}<br />
                  <span class="mono muted">ID: {{ ord.id }}</span>
                </p>
              </div>
            }

            <div class="mode-toggle">
              <button type="button" class="link-button" (click)="setOrderMode('manual')">
                ¿Ingresar identificador UUID manualmente?
              </button>
            </div>
            <!-- Keep hidden input #order-id so querySelector('#order-id') continues to work in tests -->
            <input id="order-id" type="hidden" [value]="effectiveOrderId()" />
          } @else {
            <div class="field">
              <label for="order-id">
                <strong>Identificador de la orden (UUID):</strong>
              </label>
              <input
                id="order-id"
                class="input mono"
                name="orderId"
                [ngModel]="orderId()"
                (ngModelChange)="onManualOrderIdChange($event)"
                placeholder="00000000-0000-0000-0000-000000000000"
                autocomplete="off"
              />
              @if (orders().length > 0) {
                <div class="mode-toggle">
                  <button type="button" class="link-button" (click)="setOrderMode('select')">
                    ← Volver a seleccionar de la lista de órdenes
                  </button>
                </div>
              }
            </div>
          }

          @if (openError()) {
            <span class="field-error">
              {{ orderMode() === 'select' ? 'Selecciona una orden de la lista o escribe un identificador válido.' : 'Escribe un identificador válido (formato UUID).' }}
            </span>
          }

          <div>
            <button class="btn btn--primary" type="submit" [disabled]="orderMode() === 'select' && !effectiveOrderId()">
              Abrir
            </button>
          </div>
        </form>
      </section>
      }

      @if (canCreate) {
        <section class="card stack">
          <div class="row spread">
            <div>
              <h2>Crear una orden</h2>
              <p class="muted small">Solo el médico que ordena.</p>
            </div>
            <button class="btn btn--primary" type="button" (click)="openForm()">Nueva orden</button>
          </div>
        </section>

        @if (creating()) {
          <app-modal
            tag="Nueva orden"
            headline="Crea una orden de laboratorio"
            [bullets]="bullets"
            (closed)="creating.set(false)"
          >
          @if (error(); as e) {
            <app-banner tone="danger">
              {{ e.message }}
            </app-banner>
          }
          <form class="stack" (ngSubmit)="create()" novalidate>
            <div class="field">
              <label for="patient-search">Paciente</label>
              <app-patient-picker
                [options]="patients()"
                [loading]="patientsState() === 'loading'"
                [failed]="patientsState() === 'failed'"
                (picked)="choose($event)"
              />
              @if (patientMissing()) {
                <span class="field-error">Elige un paciente de la lista.</span>
              }
            </div>
            <fieldset class="field tests">
              <legend>Pruebas a realizar</legend>
              @if (testTypesState() === 'loading') {
                <p class="muted small">Cargando pruebas…</p>
              } @else if (testTypesState() === 'failed') {
                <p class="field-error">No pudimos cargar las pruebas. Cierra y vuelve a abrir el formulario.</p>
              } @else if (testTypes().length === 0) {
                <p class="muted small">No hay pruebas disponibles en el catálogo.</p>
              } @else {
                <div class="checks">
                  @for (test of testTypes(); track test.id) {
                    <label class="check">
                      <input
                        type="checkbox"
                        [name]="'test-' + test.id"
                        [checked]="selectedTests().has(test.id)"
                        (change)="toggleTest(test.id)"
                      />
                      <span>{{ test.name }} <span class="muted small">({{ test.code }})</span></span>
                    </label>
                  }
                </div>
              }
              @if (testsMissing()) {
                <span class="field-error">Marca al menos una prueba.</span>
              }
            </fieldset>
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
                  (ngModelChange)="notes.set(clean($event))"
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
          </app-modal>
        }
      }
    </div>
  `,
  styles: `
    .grow {
      flex: 1 1 320px;
    }
    .queue {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }
    .queue-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid var(--border, #dbe3f0);
      border-radius: 14px;
      background: #fff;
    }
    .queue-info {
      display: grid;
      gap: 4px;
      flex: 1 1 320px;
      min-width: 0;
    }
    .tests {
      border: 0;
      padding: 0;
      margin: 0;
    }
    .tests legend {
      font-weight: 600;
      margin-bottom: 6px;
    }
    .checks {
      display: grid;
      gap: 6px;
      max-height: 200px;
      overflow-y: auto;
      padding: 10px 12px;
      border: 1px solid var(--border, #dbe3f0);
      border-radius: 12px;
      background: #fff;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }
    .align {
      align-self: flex-end;
    }
    .approval-form {
      display: grid;
      gap: 16px;
      max-width: 680px;
    }
    .input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .input-row select,
    .input-row input {
      flex: 1;
    }
    .appointment-summary-box {
      padding: 12px 16px;
      border-radius: 10px;
      background: var(--surface-subtle, #f8fafc);
      border: 1px solid var(--border, #e2e8f0);
    }
    .mode-toggle {
      display: flex;
      justify-content: flex-end;
      margin-top: 2px;
    }
    .link-button {
      background: none;
      border: none;
      padding: 0;
      color: var(--primary, #ea580c);
      font-size: 12px;
      cursor: pointer;
      text-decoration: underline;
    }
    .link-button:hover {
      opacity: 0.85;
    }
  `,
})
export class OrdersPage {
  protected readonly pager = new PageState();
  private readonly router = inject(Router);
  private readonly createOrder = inject(CreateOrder);
  private readonly listOrders = inject(ListOrders);
  private readonly listPatients = inject(ListPatients);
  private readonly listWorklist = inject(ListWorklist);
  private readonly confirmOrder = inject(ConfirmOrder);
  /** The completed order the laboratory is about to close, if any. */
  protected readonly confirmTarget = signal<WorklistOrder | null>(null);
  protected readonly queueBanner = signal<{ text: string; tone: 'success' | 'danger' } | null>(null);
  protected readonly confirmActions: readonly DialogAction[] = [
    { label: 'Confirmar orden', value: 'confirm', tone: 'primary' },
    { label: 'Volver', value: 'cancel', tone: 'ghost' },
  ];
  private readonly listTestTypes = inject(ListTestTypes);

  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Órdenes y resultados' },
  ];
  protected readonly canCreate = inject(SessionState).can(PERMISSIONS.ordersCreate);
  protected readonly canRecord = inject(SessionState).can(PERMISSIONS.resultsRecord);
  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  protected readonly orders = signal<readonly OrderSummary[]>([]);
  protected readonly listing = signal<'loading' | 'ready' | 'denied' | 'failed'>('loading');

  protected readonly orderId = signal('');
  protected readonly openError = signal(false);
  protected readonly orderSearchTerm = signal('');
  protected readonly selectedOrderOption = signal('');
  protected readonly orderMode = signal<'select' | 'manual'>('select');

  protected readonly filteredOrders = computed(() => {
    const list = this.orders();
    const term = this.orderSearchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter((o) => {
      const patient = this.patientName(o.patientId).toLowerCase();
      const id = o.id.toLowerCase();
      return patient.includes(term) || id.includes(term);
    });
  });

  protected readonly selectedOrder = computed(() => {
    const id = this.effectiveOrderId();
    return this.orders().find((o) => o.id === id) ?? null;
  });
  protected readonly patientId = signal('');
  protected readonly testTypes = signal<readonly TestTypeOption[]>([]);
  protected readonly testTypesState = signal<'loading' | 'ready' | 'failed'>('loading');
  protected readonly selectedTests = signal<ReadonlySet<string>>(new Set());
  protected readonly testsMissing = signal(false);
  protected readonly priority = signal<Priority>('NORMAL');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<ErrorView | null>(null);
  protected readonly creating = signal(false);
  protected readonly worklist = signal<readonly WorklistOrder[]>([]);
  protected readonly worklistState = signal<'loading' | 'ready' | 'failed'>('loading');
  private readonly route = inject(ActivatedRoute);
  protected readonly queuePager = new PageState();
  protected readonly queueFilter = signal<QueueFilter>('todas');
  protected readonly queueFilters: readonly { key: QueueFilter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'urgentes', label: 'Urgentes' },
    { key: 'paciente', label: 'Pedidas por el paciente' },
  ];
  /** Shown once after saving results: the page is reached with ?guardado=1. */
  protected readonly savedNotice = signal(this.route.snapshot.queryParamMap.get('guardado') === '1');
  protected readonly queueVisible = computed(() => {
    const filter = this.queueFilter();
    return this.worklist().filter((item) => {
      if (filter === 'urgentes') return item.priority === 'URGENTE';
      if (filter === 'paciente') return item.origin === 'PACIENTE';
      return true;
    });
  });
  protected readonly patients = signal<readonly PatientOption[]>([]);
  protected readonly patientsState = signal<'loading' | 'ready' | 'failed'>('loading');
  protected readonly patientMissing = signal(false);
  protected readonly bullets = [
    'Busca al paciente por su nombre: solo aparecen los que tienes a tu cargo.',
    'Marca las pruebas como en la solicitud en papel: puedes elegir varias.',
  ];

  constructor() {
    // A role that cannot list orders (the lab technician) gets no listing at all, not even a note about it.
    const session = inject(SessionState);
    const canList = [PERMISSIONS.ordersCreate, PERMISSIONS.resultsReadWithAccess, PERMISSIONS.reviewsRecord].some(
      (permission) => session.can(permission),
    );
    // Back from closing an order in the detail page: say so once, here in the queue.
    if (this.route.snapshot.queryParamMap.get('confirmada') === '1') {
      this.queueBanner.set({
        text: 'Orden confirmada. El paciente recibirá sus resultados por correo.',
        tone: 'success',
      });
    }
    if (canList) void this.load();
    else {
      this.listing.set('denied');
      if (this.canRecord) void this.loadWorklist();
    }
  }

  protected askConfirm(item: WorklistOrder): void {
    this.queueBanner.set(null);
    this.confirmTarget.set(item);
  }

  protected async onConfirmChoice(value: string, target: WorklistOrder): Promise<void> {
    this.confirmTarget.set(null);
    if (value !== 'confirm') return;
    try {
      await this.confirmOrder.execute(target.id);
      this.worklist.update((items) => items.filter((item) => item.id !== target.id));
      this.queueBanner.set({
        text: 'Orden confirmada. El paciente recibirá sus resultados por correo.',
        tone: 'success',
      });
    } catch {
      this.queueBanner.set({ text: 'No pudimos confirmar la orden. Intenta de nuevo.', tone: 'danger' });
    }
  }

  protected reloadWorklist(): void {
    this.worklistState.set('loading');
    void this.loadWorklist();
  }

  protected setQueueFilter(filter: QueueFilter): void {
    this.queueFilter.set(filter);
    this.queuePager.page.set(0);
  }

  protected countFor(filter: QueueFilter): number {
    if (filter === 'urgentes') return this.worklist().filter((i) => i.priority === 'URGENTE').length;
    if (filter === 'paciente') return this.worklist().filter((i) => i.origin === 'PACIENTE').length;
    return this.worklist().length;
  }

  protected originLabel(origin: string): string {
    return origin === 'PACIENTE' ? 'Pedido por el paciente' : 'Orden médica';
  }

  protected queueDate(item: WorklistOrder): string {
    return formatDate(item.orderedAt);
  }

  protected testNames(item: WorklistOrder): string {
    return item.tests.map((t) => t.name ?? 'Prueba').join(' · ');
  }

  protected pendingCount(item: WorklistOrder): number {
    return item.tests.filter((t) => t.status === 'PENDIENTE').length;
  }

  protected shortId(id: string): string {
    return id.slice(0, 8).toUpperCase();
  }

  /** The laboratory's queue: the pending orders it can record results on. */
  private async loadWorklist(): Promise<void> {
    try {
      this.worklist.set(await this.listWorklist.execute());
      this.worklistState.set('ready');
    } catch {
      this.worklistState.set('failed');
    }
  }

  /** Opens the order on the test still pending, so the laboratory fills in that one. */
  protected openFromWorklist(item: WorklistOrder): void {
    const test = item.tests.find((t) => t.status === 'PENDIENTE') ?? item.tests[0];
    void this.router.navigate(['/ordenes', item.id], {
      queryParams: test ? { detalle: test.detailId } : {},
    });
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
      const orders = await this.listOrders.execute();
      this.orders.set(orders);
      if (orders.length > 0 && !this.selectedOrderOption()) {
        this.selectedOrderOption.set(orders[0].id);
        this.orderId.set(orders[0].id);
      }
      this.listing.set('ready');
    } catch (error) {
      // 403: this role does not read orders (the lab technician), which is not a failure.
      this.listing.set(error instanceof AppError && error.kind === 'forbidden' ? 'denied' : 'failed');
    }
    void this.loadPatients();
  }

  protected openForm(): void {
    this.error.set(null);
    this.patientId.set('');
    this.patientMissing.set(false);
    this.creating.set(true);
    this.selectedTests.set(new Set());
    this.testsMissing.set(false);
    void this.loadPatients();
    void this.loadTestTypes();
  }

  private async loadTestTypes(): Promise<void> {
    this.testTypesState.set('loading');
    try {
      this.testTypes.set(await this.listTestTypes.execute());
      this.testTypesState.set('ready');
    } catch {
      this.testTypesState.set('failed');
    }
  }

  protected toggleTest(id: string): void {
    const next = new Set(this.selectedTests());
    if (!next.delete(id)) next.add(id);
    this.selectedTests.set(next);
    this.testsMissing.set(false);
  }

  private async loadPatients(): Promise<void> {
    this.patientsState.set('loading');
    try {
      this.patients.set(await this.listPatients.execute());
      this.patientsState.set('ready');
    } catch {
      this.patientsState.set('failed');
    }
  }

  protected choose(patient: PatientOption | null): void {
    this.patientId.set(patient?.id ?? '');
    this.patientMissing.set(false);
  }

  protected clean(text: string): string {
    return sanitizeFreeText(text);
  }

  protected patientName(patientId: string): string {
    const found = this.patients().find((p) => p.id === patientId);
    return found ? found.name : patientId;
  }

  protected setOrderMode(mode: 'select' | 'manual'): void {
    this.orderMode.set(mode);
    this.openError.set(false);
    if (mode === 'select' && !this.selectedOrderOption() && this.orders().length > 0) {
      this.selectedOrderOption.set(this.orders()[0].id);
      this.orderId.set(this.orders()[0].id);
    }
  }

  protected cleanSearchInput(event: Event): void {
    sanitizeInputEvent(event, sanitizeSearch);
  }

  protected onOrderSearchTermChange(term: string): void {
    const cleaned = sanitizeSearch(term);
    this.orderSearchTerm.set(cleaned);
    this.openError.set(false);
    const filtered = this.filteredOrders();
    if (filtered.length === 1) {
      this.selectedOrderOption.set(filtered[0].id);
      this.orderId.set(filtered[0].id);
    } else if (!filtered.some((o) => o.id === this.selectedOrderOption())) {
      this.selectedOrderOption.set('');
    }
  }

  protected onOrderSelectChange(id: string): void {
    this.selectedOrderOption.set(id);
    this.orderId.set(id);
    this.openError.set(false);
  }

  protected onManualOrderIdChange(id: string): void {
    const cleaned = sanitizeIdentifier(id);
    this.orderId.set(cleaned);
    this.openError.set(false);
  }

  protected clearOrderSearch(): void {
    this.orderSearchTerm.set('');
    this.openError.set(false);
    const filtered = this.filteredOrders();
    if (filtered.length > 0) {
      this.selectedOrderOption.set(filtered[0].id);
      this.orderId.set(filtered[0].id);
    }
  }

  protected effectiveOrderId(): string {
    if (this.orderMode() === 'manual' || this.orders().length === 0) {
      return this.orderId().trim();
    }
    if (this.selectedOrderOption()) {
      return this.selectedOrderOption();
    }
    const filtered = this.filteredOrders();
    if (filtered.length === 1) {
      return filtered[0].id;
    }
    return this.orderId().trim();
  }

  protected async open(): Promise<void> {
    const id = this.effectiveOrderId();
    if (!isUuid(id)) {
      this.openError.set(true);
      return;
    }
    await this.router.navigate(['/ordenes', id]);
  }

  protected async create(): Promise<void> {
    this.patientMissing.set(!this.patientId());
    this.testsMissing.set(this.selectedTests().size === 0);
    if (this.patientMissing() || this.testsMissing()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const order = await this.createOrder.execute({
        patientId: this.patientId(),
        testTypeIds: [...this.selectedTests()],
        priority: this.priority(),
        notes: this.notes(),
      });
      await this.router.navigate(['/ordenes', order.id]);
    } catch (error) {
      this.error.set(
        describeError(error, {
          validation: 'Revisa los datos de la orden: elige un paciente y al menos una prueba (máximo 20).',
          forbidden: 'Solo un médico con perfil profesional puede crear órdenes.',
          not_found: 'No encontramos a ese paciente.',
        }),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
