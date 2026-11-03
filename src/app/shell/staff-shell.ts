import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { PERMISSIONS, ROLE_LABELS } from '../features/auth/domain/policies/staff-access';
import { SessionState } from '../features/auth/presentation/session.state';
import { ChipComponent } from '../shared/presentation/atoms/chip';
import { LogoComponent } from '../shared/presentation/atoms/logo';

/** Frame of every signed-in page: navigation, who is signed in and the sign-out button. */
@Component({
  selector: 'app-staff-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ChipComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <aside class="side">
        <app-logo />
        <nav aria-label="Navegación principal" class="nav">
          <a routerLink="/inicio" routerLinkActive="active">Inicio</a>
          @if (canReadKnowledge()) {
            <a routerLink="/conocimiento" routerLinkActive="active">Conocimiento clínico</a>
          }
          <span class="soon" title="Pendiente: faltan endpoints de listado"
            >Órdenes y resultados</span
          >
          <span class="soon">Usuarios y roles</span>
        </nav>
      </aside>

      <div class="main">
        <header class="top">
          <div class="row">
            @for (role of roles(); track role) {
              <app-chip>{{ roleLabel(role) }}</app-chip>
            }
          </div>
          <button class="btn btn--small" type="button" (click)="signOut()">Cerrar sesión</button>
        </header>
        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    .layout {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 250px 1fr;
    }
    .side {
      background: var(--surface);
      border-right: 1px solid var(--line);
      padding: 22px 16px;
      display: flex;
      flex-direction: column;
      gap: 26px;
    }
    .nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .nav a,
    .nav .soon {
      padding: 10px 14px;
      border-radius: var(--radius-md);
      font-weight: 600;
      color: var(--text);
      text-decoration: none;
    }
    .nav a:hover {
      background: var(--orange-tint);
    }
    .nav a.active {
      background: var(--orange-tint);
      color: var(--orange-deep);
    }
    .nav .soon {
      color: var(--muted);
      cursor: not-allowed;
      opacity: 0.7;
    }
    .main {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 28px;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
    }
    .content {
      padding: 28px;
      max-width: 1100px;
      width: 100%;
    }
    @media (max-width: 860px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .side {
        border-right: 0;
        border-bottom: 1px solid var(--line);
        gap: 12px;
      }
      .nav {
        flex-direction: row;
        flex-wrap: wrap;
      }
      .content {
        padding: 18px;
      }
    }
  `,
})
export class StaffShell {
  private readonly session = inject(SessionState);
  private readonly router = inject(Router);

  protected readonly roles = () => this.session.user()?.roles ?? [];
  protected readonly roleLabel = (role: string) => ROLE_LABELS[role] ?? role;
  protected readonly canReadKnowledge = () => this.session.can(PERMISSIONS.knowledgeRead);

  constructor() {
    // Any way the session ends (button, expiry, a 401 from the API) lands on the login page.
    effect(() => {
      if (this.session.isSignedIn()) return;
      const expired = this.session.endReason() === 'expirada';
      void this.router.navigate(['/login'], { queryParams: expired ? { motivo: 'expirada' } : {} });
    });
  }

  protected signOut(): void {
    this.session.signOut('cerrada');
  }
}
