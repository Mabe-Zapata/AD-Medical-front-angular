import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { BannerComponent } from '../../../shared/presentation/atoms/banner';
import { visibleModules } from '../../../shell/app-modules';
import { PERMISSIONS, ROLE_LABELS } from '../../auth/domain/policies/staff-access';
import { SessionState } from '../../auth/presentation/session.state';
import { ListAnalytes } from '../../knowledge/domain/usecases/knowledge-usecases';
import { OrderSummary } from '../../orders/domain/entities/orders';
import { ListOrders } from '../../orders/domain/usecases/orders-usecases';
import { ORDER_STATUS_LABELS } from '../../orders/presentation/labels';
import { UserSummary } from '../../users/domain/entities/users';
import { ListUsers } from '../../users/domain/usecases/users-usecases';

interface Bar {
  readonly label: string;
  readonly count: number;
  readonly percent: number;
}

/** Counts per key, as bars scaled to the biggest group (so the longest bar is always full). */
function bars(keys: readonly string[], labels: Readonly<Record<string, string>>, of: readonly string[]): Bar[] {
  const counts = keys.map((key) => of.filter((value) => value === key).length);
  const max = Math.max(1, ...counts);
  return keys.map((key, i) => ({
    label: labels[key] ?? key,
    count: counts[i],
    percent: Math.round((counts[i] / max) * 100),
  }));
}

/**
 * Container: the landing page. A summary of the system with only what this role may read (each
 * block loads on its own and simply stays out when the role cannot see it), then the modules.
 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (noPermission) {
        <app-banner tone="warning">
          Tu rol no tiene acceso a esa sección. Estos son los módulos que sí puedes usar.
        </app-banner>
      }

      <header>
        <div class="eyebrow">Medilo · {{ roleNames() }}</div>
        <h1>Resumen del sistema</h1>
        <p class="muted">{{ today }}</p>
      </header>

      <section class="grid-links" aria-label="Accesos">
        @for (module of modules(); track module.title; let first = $first) {
          @if (module.link) {
            <a class="tile" [class.tile--main]="first" [routerLink]="module.link">
              <strong>{{ module.title }}</strong>
              <span>{{ module.description }}</span>
            </a>
          }
        }
      </section>

      @if (kpis().length > 0) {
        <section class="kpis" aria-label="Indicadores clave">
          @for (kpi of kpis(); track kpi.label) {
            <article class="card kpi">
              <span class="kpi-label">{{ kpi.label }}</span>
              <span class="kpi-value">{{ kpi.value }}</span>
              <span class="muted small">{{ kpi.note }}</span>
            </article>
          }
        </section>
      }

      <section class="summary">
        @if (orderBars().length > 0) {
          <article class="card stack">
            <h2>Órdenes por estado</h2>
            @for (bar of orderBars(); track bar.label) {
              <div class="bar-row">
                <div class="row spread small">
                  <span>{{ bar.label }}</span>
                  <strong>{{ bar.count }}</strong>
                </div>
                <div class="track"><div class="fill" [style.width.%]="bar.percent"></div></div>
              </div>
            }
          </article>
        }
        @if (roleBars().length > 0) {
          <article class="card stack">
            <h2>Cuentas por rol</h2>
            @for (bar of roleBars(); track bar.label) {
              <div class="bar-row">
                <div class="row spread small">
                  <span>{{ bar.label }}</span>
                  <strong>{{ bar.count }}</strong>
                </div>
                <div class="track"><div class="fill" [style.width.%]="bar.percent"></div></div>
              </div>
            }
          </article>
        }
      </section>

      @if (inactive() > 0) {
        <section class="card stack">
          <h2>Requiere tu atención</h2>
          <div class="row spread attention">
            <div>
              <strong>{{ inactive() }} cuentas todavía sin activar</strong>
              <p class="muted small">Su enlace de activación vence a las 24 horas.</p>
            </div>
            <a routerLink="/usuarios">Ver cuentas →</a>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    h1 {
      margin-top: 2px;
      font-size: 32px;
    }
    .grid-links {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 16px 18px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--blue-soft);
      background: var(--surface);
      color: var(--ink);
      text-decoration: none;
    }
    .tile span {
      font-size: 12.5px;
      color: var(--muted);
    }
    .tile:hover {
      border-color: var(--orange);
    }
    .tile--main {
      background: linear-gradient(90deg, var(--orange), var(--orange-deep));
      border-color: transparent;
      color: #fff;
      box-shadow: 0 8px 18px rgb(194 65 12 / 30%);
    }
    .tile--main span {
      color: #fff;
    }
    .kpis,
    .summary {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    }
    .summary {
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .kpi-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--blue-text);
    }
    .kpi-value {
      font-size: 40px;
      font-weight: 800;
      line-height: 1;
      color: var(--ink);
    }
    .bar-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .track {
      height: 10px;
      border-radius: 999px;
      background: var(--blue-tint);
    }
    .fill {
      height: 100%;
      border-radius: 999px;
      background: var(--blue);
    }
    .attention {
      border-top: 1px solid var(--line);
      padding-top: 12px;
    }
  `,
})
export class HomePage {
  private readonly session = inject(SessionState);

  protected readonly noPermission = inject(ActivatedRoute).snapshot.queryParamMap.has('sinPermiso');
  protected readonly modules = () => visibleModules((permission) => this.session.can(permission));
  protected readonly roleNames = () =>
    (this.session.user()?.roles ?? []).map((role) => ROLE_LABELS[role] ?? role).join(' · ');
  protected readonly today = new Date().toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  private readonly users = signal<readonly UserSummary[] | null>(null);
  private readonly analytes = signal<number | null>(null);
  private readonly orders = signal<readonly OrderSummary[] | null>(null);

  protected readonly inactive = computed(() => this.users()?.filter((u) => !u.active).length ?? 0);

  protected readonly kpis = computed(() => {
    const list: { label: string; value: string; note: string }[] = [];
    const users = this.users();
    if (users !== null) {
      const active = users.filter((u) => u.active).length;
      list.push({ label: 'Cuentas activas', value: `${active}`, note: `de ${users.length} cuentas` });
    }
    const orders = this.orders();
    if (orders !== null) {
      const done = orders.filter((o) => o.status === 'COMPLETADA').length;
      list.push({ label: 'Órdenes', value: `${orders.length}`, note: 'las que puedes leer' });
      const percent = orders.length === 0 ? 0 : Math.round((done / orders.length) * 100);
      list.push({ label: 'Completadas', value: `${percent} %`, note: `${done} de ${orders.length}` });
    }
    const analytes = this.analytes();
    if (analytes !== null) {
      list.push({ label: 'Analitos activos', value: `${analytes}`, note: 'en el catálogo clínico' });
    }
    return list;
  });

  protected readonly orderBars = computed(() => {
    const orders = this.orders();
    if (orders === null || orders.length === 0) return [];
    return bars(Object.keys(ORDER_STATUS_LABELS), ORDER_STATUS_LABELS, orders.map((o) => o.status));
  });

  protected readonly roleBars = computed(() => {
    const users = this.users();
    if (users === null || users.length === 0) return [];
    return bars(Object.keys(ROLE_LABELS), ROLE_LABELS, users.flatMap((u) => u.roles));
  });

  constructor() {
    const can = (permission: string) => this.session.can(permission);
    // Each block loads alone: a role that cannot read one simply does not get it (the API says 403).
    if (can(PERMISSIONS.usersAdmin)) {
      void inject(ListUsers).execute().then((list) => this.users.set(list)).catch(() => undefined);
    }
    if (can(PERMISSIONS.knowledgeRead)) {
      void inject(ListAnalytes)
        .execute()
        .then((list) => this.analytes.set(list.length))
        .catch(() => undefined);
    }
    if (
      [PERMISSIONS.ordersCreate, PERMISSIONS.reviewsRecord, PERMISSIONS.resultsReadWithAccess].some(can)
    ) {
      void inject(ListOrders).execute().then((list) => this.orders.set(list)).catch(() => undefined);
    }
  }
}
