import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { BannerComponent } from '../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../shared/presentation/atoms/chip';
import { PaginatorComponent } from '../../../shared/presentation/molecules/paginator';
import { PageState } from '../../../shared/presentation/pagination';
import { visibleModules } from '../../../shell/app-modules';
import { PERMISSIONS, ROLE_LABELS } from '../../auth/domain/policies/staff-access';
import { SessionState } from '../../auth/presentation/session.state';
import { KnowledgeSummary } from '../../knowledge/domain/entities/knowledge';
import { GetKnowledgeSummary, ListAnalytes } from '../../knowledge/domain/usecases/knowledge-usecases';
import { OrderSummary } from '../../orders/domain/entities/orders';
import { ListOrders } from '../../orders/domain/usecases/orders-usecases';
import { ORDER_STATUS_LABELS } from '../../orders/presentation/labels';
import { UserSummary } from '../../users/domain/entities/users';
import { ListUsers } from '../../users/domain/usecases/users-usecases';

/** The access token lives 15 minutes (the login page says so too). */
const SESSION_MS = 15 * 60 * 1000;

interface Bar {
  readonly label: string;
  readonly count: number;
  readonly percent: number;
}

interface Kpi {
  readonly label: string;
  readonly value: string;
  readonly note: string;
  /** A number that asks for something to be done: marked with an orange dot. */
  readonly flag: boolean;
}

interface Attention {
  readonly title: string;
  readonly note: string;
  readonly action: string;
  readonly link: string;
  readonly kind: 'accounts' | 'references' | 'rules';
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

/** "1 cuenta" / "7 cuentas". */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Whole-number share of `part` in `total`, 0 when there is nothing. */
function share(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

/** A donut as a conic gradient: blue for what is ready, orange for what is pending. */
function donut(ready: number, total: number): string {
  const percent = total === 0 ? 100 : share(ready, total);
  return `conic-gradient(var(--blue) 0 ${percent}%, #ff8a3d ${percent}% 100%)`;
}

/**
 * Container: the landing page. A summary of the system with only what this role may read (each
 * block loads on its own and simply stays out when the role cannot see it), then the modules.
 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, BannerComponent, ChipComponent, PaginatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="home">
      @if (noPermission) {
        <app-banner tone="warning">
          Tu rol no tiene acceso a esa sección. Estos son los módulos que sí puedes usar.
        </app-banner>
      }

      <section class="hello">
        <div class="hello-copy">
          <span class="pill">Medilo · {{ roleNames() }}</span>
          <h1>Resumen <span class="accent">del sistema</span></h1>
          <p class="lead">{{ today }}. Lo que necesita tu atención hoy y el estado del sistema.</p>
          @if (canCreateUser || canCreateAnalyte) {
            <div class="row actions">
              @if (canCreateUser) {
                <a class="btn btn--primary" routerLink="/usuarios" [queryParams]="{ nuevo: 1 }">Crear usuario</a>
              }
              @if (canCreateAnalyte) {
                <a class="btn" routerLink="/conocimiento/analitos" [queryParams]="{ nuevo: 1 }">Nuevo analito</a>
              }
            </div>
          }
        </div>
        <aside class="session" aria-label="Sesión">
          <div class="row">
            <span class="icon icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>
            </span>
            <div class="stack-tight">
              <strong>Sesión segura</strong>
              <span class="muted small">Se cierra a los 15 minutos</span>
            </div>
          </div>
          <div class="track" role="progressbar" aria-label="Tiempo de sesión restante" [attr.aria-valuenow]="remainingPercent()" aria-valuemin="0" aria-valuemax="100">
            <div class="fill" [style.width.%]="remainingPercent()"></div>
          </div>
          <span class="small blue-text">Te quedan <strong>{{ countdown() }}</strong> de esta sesión</span>
        </aside>
      </section>

      @if (kpis().length > 0) {
        <section class="kpis" aria-label="Indicadores clave">
          @for (kpi of kpis(); track kpi.label) {
            <article class="kpi">
              <span class="kpi-label">{{ kpi.label }}</span>
              <span class="kpi-value">{{ kpi.value }} @if (kpi.flag) {<span class="dot" aria-hidden="true"></span>}</span>
              <span class="kpi-note">{{ kpi.note }}</span>
            </article>
          }
        </section>
      }

      @if (attention().length > 0 || users() !== null || knowledge() !== null) {
        <section class="duo">
          @if (users() !== null || knowledge() !== null) {
            <article class="island island--wide">
              <header class="island-head">
                <span class="label label--orange">Requiere tu atención</span>
                <h2>Pendientes de hoy</h2>
              </header>
              @for (item of attention(); track item.kind) {
                <div class="todo" [class.todo--main]="item.kind === 'accounts'">
                  <div class="row">
                    <span class="icon" [class.icon--orange]="item.kind === 'accounts'" [class.icon--blue]="item.kind !== 'accounts'" aria-hidden="true">
                      @switch (item.kind) {
                        @case ('accounts') {
                          <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20c.6-3.2 3-5 6-5s5.4 1.8 6 5M17 11l2 2 3-4" /></svg>
                        }
                        @case ('references') {
                          <svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" /></svg>
                        }
                        @default {
                          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6" /></svg>
                        }
                      }
                    </span>
                    <div class="stack-tight">
                      <strong>{{ item.title }}</strong>
                      <span class="muted small">{{ item.note }}</span>
                    </div>
                  </div>
                  <a class="btn btn--small" [class.btn--primary]="item.kind === 'accounts'" [routerLink]="item.link">{{ item.action }}</a>
                </div>
              } @empty {
                <p class="clear">Nada pendiente por ahora: no hay cuentas sin activar ni borradores por validar.</p>
              }
            </article>
          }

          @if (users() !== null && users()!.length > 0) {
            <article class="island">
              <header class="island-head">
                <span class="label">Cuentas</span>
                <h2>Quién usa el sistema</h2>
              </header>
              <div class="row donut-row">
                <div class="donut" [style.background]="accountsDonut()" role="img" [attr.aria-label]="activeCount() + ' cuentas activas y ' + inactive() + ' sin activar'">
                  <div class="donut-hole"><strong>{{ users()!.length }}</strong><span>cuentas</span></div>
                </div>
                <div class="legend">
                  <span><i class="swatch swatch--blue"></i>Activas <strong>{{ activeCount() }}</strong></span>
                  <span><i class="swatch swatch--orange"></i>Sin activar <strong class="orange-text">{{ inactive() }}</strong></span>
                </div>
              </div>
              <div class="bars">
                @for (bar of roleBars(); track bar.label) {
                  <div class="bar-row">
                    <div class="row spread small">
                      <span>{{ bar.label }}</span>
                      <strong>{{ bar.count }}</strong>
                    </div>
                    <div class="track"><div class="fill" [style.width.%]="bar.percent"></div></div>
                  </div>
                }
              </div>
            </article>
          }
        </section>
      }

      @if (knowledge(); as k) {
        <section class="island">
          <header class="island-head row spread">
            <div class="stack-tight">
              <span class="label">Conocimiento clínico</span>
              <h2>Qué está listo para usarse</h2>
            </div>
            <a routerLink="/conocimiento">Abrir conocimiento clínico →</a>
          </header>
          <div class="trio">
            <article class="part">
              <div class="row"><span class="icon icon--blue" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" /></svg></span><strong>Analitos</strong></div>
              <div class="big"><span class="big-value">{{ k.analytes }}</span><span class="small blue-text">activos en el catálogo</span></div>
              <p class="muted small grow">Lo que se mide en el laboratorio. Cada analito tiene sus rangos de referencia.</p>
              @if (canCreateAnalyte) {
                <a class="btn btn--small" routerLink="/conocimiento/analitos" [queryParams]="{ nuevo: 1 }">Nuevo analito</a>
              }
            </article>
            <article class="part">
              <div class="row"><span class="icon icon--blue" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 18V6M4 18h16M8 14l3-4 3 2 4-6" /></svg></span><strong>Rangos de referencia</strong></div>
              <div class="row donut-row">
                <div class="donut donut--small" [style.background]="referencesDonut()" role="img" [attr.aria-label]="k.referencesValidated + ' validados y ' + k.referencesDraft + ' en borrador'">
                  <div class="donut-hole donut-hole--part"><strong>{{ k.referencesValidated + k.referencesDraft }}</strong><span>en total</span></div>
                </div>
                <div class="legend">
                  <span><i class="swatch swatch--blue"></i><strong>{{ k.referencesValidated }}</strong> validados</span>
                  <span><i class="swatch swatch--orange"></i><strong class="orange-text">{{ k.referencesDraft }}</strong> en borrador</span>
                </div>
              </div>
              <p class="muted small grow">Un borrador no se usa hasta que un médico lo valida.</p>
              @if (k.referencesDraft > 0) {
                <a class="btn btn--small btn--primary" routerLink="/conocimiento/borradores">Ver {{ k.referencesDraft }} {{ k.referencesDraft === 1 ? 'borrador' : 'borradores' }}</a>
              }
            </article>
            @if (showRules) {
            <article class="part">
              <div class="row"><span class="icon icon--blue" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6" /></svg></span><strong>Reglas del motor</strong></div>
              <div class="row donut-row">
                <div class="donut donut--small" [style.background]="rulesDonut()" role="img" [attr.aria-label]="k.rulesValidated + ' validadas y ' + k.rulesDraft + ' en borrador'">
                  <div class="donut-hole donut-hole--part"><strong>{{ k.rulesValidated + k.rulesDraft }}</strong><span>en total</span></div>
                </div>
                <div class="legend">
                  <span><i class="swatch swatch--blue"></i><strong>{{ k.rulesValidated }}</strong> validadas</span>
                  <span><i class="swatch swatch--orange"></i><strong class="orange-text">{{ k.rulesDraft }}</strong> en borrador</span>
                </div>
              </div>
              <p class="muted small grow">Las reglas validadas son las que usa el motor de propuestas.</p>
              @if (k.rulesDraft > 0) {
                <a class="btn btn--small btn--primary" routerLink="/conocimiento/borradores">Ver {{ k.rulesDraft }} {{ k.rulesDraft === 1 ? 'borrador' : 'borradores' }}</a>
              }
            </article>
            }
          </div>
        </section>
      }

      @if (inactiveUsers().length > 0) {
        <section class="island">
          <header class="island-head row spread">
            <div class="stack-tight">
              <span class="label label--orange">Por activar</span>
              <h2>Cuentas sin activar</h2>
            </div>
            <a routerLink="/usuarios">Ver todas →</a>
          </header>
          <div class="table-scroll">
            <table class="table">
              <thead>
                <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr>
              </thead>
              <tbody>
                @for (user of inactivePage.slice(inactiveUsers()); track user.id) {
                  <tr>
                    <td><strong>{{ user.firstName }} {{ user.lastName }}</strong></td>
                    <td class="muted">{{ user.email }}</td>
                    <td>
                      @for (role of user.roles; track role) {
                        <app-chip>{{ roleLabel(role) }}</app-chip>
                      }
                    </td>
                    <td><app-chip tone="warning">Sin activar</app-chip></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [total]="inactiveUsers().length" [state]="inactivePage" />
        </section>
      }

      @if (orderBars().length > 0) {
        <section class="island">
          <header class="island-head">
            <span class="label">Órdenes</span>
            <h2>Órdenes por estado</h2>
          </header>
          <div class="bars">
            @for (bar of orderBars(); track bar.label) {
              <div class="bar-row">
                <div class="row spread small">
                  <span>{{ bar.label }}</span>
                  <strong>{{ bar.count }}</strong>
                </div>
                <div class="track"><div class="fill" [style.width.%]="bar.percent"></div></div>
              </div>
            }
          </div>
        </section>
      }

      <section class="modules" aria-label="Accesos">
        <span class="label">Accesos</span>
        <div class="tiles">
          @for (module of modules(); track module.title; let i = $index) {
            @if (module.link) {
              <a class="tile" [routerLink]="module.link">
                <span class="icon icon--big" [class.icon--orange]="i % 2 === 1" [class.icon--blue]="i % 2 === 0" aria-hidden="true">
                  @switch (module.link) {
                    @case ('/usuarios') {
                      <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20c.6-3.2 3-5 6-5s5.4 1.8 6 5M17 11l2 2 3-4" /></svg>
                    }
                    @case ('/conocimiento') {
                      <svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" /></svg>
                    }
                    @default {
                      <svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>
                    }
                  }
                </span>
                <strong>{{ module.title }}</strong>
                <span class="muted small">{{ module.description }}</span>
                <span class="open">Abrir →</span>
              </a>
            }
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: #fff;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .home {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .stack-tight {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .grow {
      flex: 1;
      margin: 0;
    }
    .blue-text {
      color: var(--blue-text);
    }
    .orange-text {
      color: var(--orange-deep);
    }

    /* Greeting */
    .hello {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 32px;
      padding: 12px 0 72px;
    }
    .hello-copy {
      flex: 1 1 520px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .pill {
      align-self: flex-start;
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid var(--orange-soft);
      background: var(--orange-tint);
      color: var(--orange-deep);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: 52px;
      line-height: 1.05;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .accent {
      color: var(--orange);
    }
    .lead {
      margin: 0;
      max-width: 600px;
      font-size: 17px;
      line-height: 1.6;
      color: #475569;
    }
    .actions {
      margin-top: 6px;
      gap: 12px;
    }
    .session {
      flex: 0 1 320px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 18px 22px;
      border-radius: 22px;
      background: var(--surface);
      box-shadow: 0 14px 34px rgb(18 55 111 / 10%);
    }

    /* Key figures: a deep-blue card that rides up over the greeting */
    .kpis {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-wrap: wrap;
      margin-top: -72px;
      padding: 34px 12px;
      border-radius: 36px;
      background: var(--blue-deep);
      color: #fff;
      box-shadow: 0 30px 60px rgb(18 55 111 / 28%);
    }
    .kpis::before,
    .kpis::after {
      content: '';
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    .kpis::before {
      right: -70px;
      top: -90px;
      width: 240px;
      height: 240px;
      background: var(--blue);
      opacity: 0.6;
    }
    .kpis::after {
      left: 44%;
      bottom: -80px;
      width: 150px;
      height: 150px;
      background: var(--orange);
      opacity: 0.35;
    }
    .kpi {
      position: relative;
      flex: 1 1 220px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 0 28px;
    }
    .kpi + .kpi {
      border-left: 1px solid rgb(214 226 245 / 25%);
    }
    .kpi-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--blue-soft);
    }
    .kpi-value {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 46px;
      font-weight: 800;
      line-height: 1;
    }
    .kpi-note {
      font-size: 13px;
      color: var(--blue-soft);
    }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ff8a3d;
    }

    /* Islands: white rounded cards on the page background */
    .island {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 32px 36px;
      border-radius: 36px;
      background: rgb(255 255 255 / 90%);
      box-shadow: 0 24px 60px rgb(18 55 111 / 10%);
    }
    .island h2 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      color: var(--ink);
    }
    .island-head {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .island-head.row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    .label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--blue-text);
    }
    .label::before {
      content: '';
      width: 20px;
      height: 2px;
      background: var(--blue);
    }
    .label--orange {
      color: var(--orange);
    }
    .label--orange::before {
      background: var(--orange);
    }
    .duo {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: stretch;
    }
    .duo > .island {
      flex: 1 1 380px;
      min-width: 0;
    }
    .duo > .island--wide {
      flex: 1.4 1 540px;
    }

    .todo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 18px 22px;
      border-radius: 20px;
      background: var(--blue-tint);
    }
    .todo--main {
      background: var(--orange-tint);
    }
    .clear {
      margin: 0;
      padding: 18px 22px;
      border-radius: 20px;
      background: var(--blue-tint);
      color: var(--blue-text);
    }
    .icon {
      flex: none;
      width: 46px;
      height: 46px;
      border-radius: 14px;
      display: grid;
      place-items: center;
    }
    .icon--big {
      width: 48px;
      height: 48px;
    }
    .icon--blue {
      background: var(--blue);
    }
    .icon--orange {
      background: var(--orange);
    }

    .donut-row {
      gap: 22px;
    }
    .donut {
      flex: none;
      width: 140px;
      height: 140px;
      border-radius: 50%;
      display: grid;
      place-items: center;
    }
    .donut--small {
      width: 104px;
      height: 104px;
    }
    .donut-hole {
      width: 92px;
      height: 92px;
      border-radius: 50%;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .donut-hole--part {
      width: 68px;
      height: 68px;
      background: var(--blue-tint);
    }
    .donut-hole strong {
      font-size: 26px;
      line-height: 1;
      color: var(--ink);
    }
    .donut-hole--part strong {
      font-size: 22px;
    }
    .donut-hole span {
      font-size: 11px;
      color: var(--muted);
    }
    .legend {
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 14px;
    }
    .legend span {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .swatch {
      width: 12px;
      height: 12px;
      border-radius: 4px;
    }
    .swatch--blue {
      background: var(--blue);
    }
    .swatch--orange {
      background: #ff8a3d;
    }
    .bars {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bar-row {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .track {
      height: 10px;
      border-radius: 999px;
      background: var(--blue-tint);
      overflow: hidden;
    }
    .fill {
      height: 100%;
      border-radius: 999px;
      background: var(--blue);
    }

    .trio {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    .part {
      flex: 1 1 260px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 26px 26px 24px;
      border-radius: 26px;
      background: var(--blue-tint);
    }
    .part > .btn {
      align-self: flex-start;
    }
    .big {
      display: flex;
      align-items: flex-end;
      gap: 10px;
    }
    .big-value {
      font-size: 56px;
      font-weight: 800;
      line-height: 0.9;
      color: var(--blue-deep);
    }

    .table-scroll {
      overflow-x: auto;
    }
    .table {
      width: 100%;
      min-width: 560px;
      border-collapse: collapse;
      font-size: 14px;
    }
    .table th {
      padding: 10px 14px;
      text-align: left;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--blue-text);
      background: var(--blue-tint);
    }
    .table th:first-child {
      border-radius: 14px 0 0 14px;
    }
    .table th:last-child {
      border-radius: 0 14px 14px 0;
    }
    .table td {
      padding: 14px;
      border-bottom: 1px solid var(--line);
    }

    .modules {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding-top: 24px;
    }
    .tiles {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
    }
    .tile {
      flex: 1 1 280px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 26px 28px;
      border-radius: 26px;
      background: var(--surface);
      color: var(--ink);
      text-decoration: none;
      box-shadow: 0 14px 34px rgb(18 55 111 / 10%);
    }
    .tile strong {
      font-size: 18px;
    }
    .tile:hover {
      box-shadow: 0 18px 40px rgb(18 55 111 / 16%);
    }
    .open {
      font-weight: 800;
      font-size: 14px;
      color: var(--blue-deep);
    }

    @media (max-width: 720px) {
      h1 {
        font-size: 38px;
      }
      .island {
        padding: 24px 20px;
        border-radius: 28px;
      }
      .kpi + .kpi {
        border-left: 0;
      }
      .kpi {
        padding: 10px 24px;
      }
    }
  `,
})
export class HomePage {
  private readonly session = inject(SessionState);

  protected readonly noPermission = inject(ActivatedRoute).snapshot.queryParamMap.has('sinPermiso');
  protected readonly modules = () => visibleModules((permission) => this.session.can(permission));
  protected readonly roleNames = () =>
    (this.session.user()?.roles ?? []).map((role) => ROLE_LABELS[role] ?? role).join(' · ');
  protected readonly roleLabel = (role: string) => ROLE_LABELS[role] ?? role;
  protected readonly today = (() => {
    const text = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  })();

  protected readonly canCreateUser = this.session.can(PERMISSIONS.usersAdmin);
  protected readonly canCreateAnalyte = this.session.can(PERMISSIONS.knowledgeAdmin);
  /** The rules area (list, create, summary) belongs to the administrator only. */
  protected readonly showRules = this.canCreateAnalyte;

  protected readonly users = signal<readonly UserSummary[] | null>(null);
  private readonly analytes = signal<number | null>(null);
  protected readonly knowledge = signal<KnowledgeSummary | null>(null);
  private readonly orders = signal<readonly OrderSummary[] | null>(null);

  protected readonly inactivePage = new PageState();

  // Session clock: the time left until the token expires, ticking once a second.
  private readonly remaining = signal(this.remainingMs());
  protected readonly remainingPercent = computed(() =>
    Math.round(Math.min(1, this.remaining() / SESSION_MS) * 100),
  );
  protected readonly countdown = computed(() => {
    const seconds = Math.floor(this.remaining() / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  });

  protected readonly inactiveUsers = computed(() => this.users()?.filter((u) => !u.active) ?? []);
  protected readonly inactive = computed(() => this.inactiveUsers().length);
  protected readonly activeCount = computed(() => (this.users()?.length ?? 0) - this.inactive());

  protected readonly kpis = computed(() => {
    const list: Kpi[] = [];
    const users = this.users();
    if (users !== null) {
      list.push({
        label: 'Cuentas activas',
        value: `${this.activeCount()}`,
        note: `de ${users.length} cuentas en total`,
        flag: false,
      });
      list.push({
        label: 'Sin activar',
        value: `${this.inactive()}`,
        note: 'su enlace vence a las 24 horas',
        flag: this.inactive() > 0,
      });
    }
    const knowledge = this.knowledge();
    const analytes = knowledge?.analytes ?? this.analytes();
    if (analytes !== null) {
      list.push({ label: 'Analitos activos', value: `${analytes}`, note: 'en el catálogo clínico', flag: false });
    }
    if (knowledge !== null) {
      const drafts = knowledge.referencesDraft + (this.showRules ? knowledge.rulesDraft : 0);
      list.push({
        label: 'Por validar',
        value: `${drafts}`,
        note: this.showRules ? 'referencias y reglas en borrador' : 'referencias en borrador',
        flag: drafts > 0,
      });
    }
    const orders = this.orders();
    if (orders !== null) {
      const done = orders.filter((o) => o.status === 'COMPLETADA').length;
      list.push({ label: 'Órdenes', value: `${orders.length}`, note: 'las que puedes leer', flag: false });
      const percent = orders.length === 0 ? 0 : Math.round((done / orders.length) * 100);
      list.push({ label: 'Completadas', value: `${percent} %`, note: `${done} de ${orders.length}`, flag: false });
    }
    return list;
  });

  protected readonly attention = computed(() => {
    const list: Attention[] = [];
    const inactive = this.inactive();
    if (inactive > 0) {
      list.push({
        kind: 'accounts',
        title: `${plural(inactive, 'cuenta todavía sin activar', 'cuentas todavía sin activar')}`,
        note: 'Su enlace de activación vence a las 24 horas.',
        action: 'Ver cuentas',
        link: '/usuarios',
      });
    }
    const knowledge = this.knowledge();
    if (knowledge !== null && knowledge.referencesDraft > 0) {
      list.push({
        kind: 'references',
        title: plural(knowledge.referencesDraft, 'referencia en borrador', 'referencias en borrador'),
        note: 'Esperan la validación de un médico antes de usarse.',
        action: 'Ver referencias',
        link: '/conocimiento/borradores',
      });
    }
    if (this.showRules && knowledge !== null && knowledge.rulesDraft > 0) {
      list.push({
        kind: 'rules',
        title: plural(knowledge.rulesDraft, 'regla en borrador', 'reglas en borrador'),
        note: 'Esperan la validación de un médico antes de usarse.',
        action: 'Ver reglas',
        link: '/conocimiento/borradores',
      });
    }
    return list;
  });

  protected readonly accountsDonut = computed(() => donut(this.activeCount(), this.users()?.length ?? 0));
  protected readonly referencesDonut = computed(() => {
    const k = this.knowledge();
    return donut(k?.referencesValidated ?? 0, (k?.referencesValidated ?? 0) + (k?.referencesDraft ?? 0));
  });
  protected readonly rulesDonut = computed(() => {
    const k = this.knowledge();
    return donut(k?.rulesValidated ?? 0, (k?.rulesValidated ?? 0) + (k?.rulesDraft ?? 0));
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
    if (can(PERMISSIONS.knowledgeAdmin) || can(PERMISSIONS.knowledgeValidate)) {
      void inject(GetKnowledgeSummary)
        .execute(this.showRules)
        .then((summary) => this.knowledge.set(summary))
        .catch(() => undefined);
    } else if (can(PERMISSIONS.knowledgeRead)) {
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

    const timer = setInterval(() => this.remaining.set(this.remainingMs()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private remainingMs(): number {
    const expiresAt = this.session.session()?.expiresAt ?? Date.now();
    return Math.max(0, expiresAt - Date.now());
  }
}
