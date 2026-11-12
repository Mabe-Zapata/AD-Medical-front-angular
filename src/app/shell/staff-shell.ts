import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { PERMISSIONS, ROLE_LABELS } from '../features/auth/domain/policies/staff-access';
import { SessionState } from '../features/auth/presentation/session.state';
import { ListUsers } from '../features/users/domain/usecases/users-usecases';
import { ChipComponent } from '../shared/presentation/atoms/chip';
import { LogoComponent } from '../shared/presentation/atoms/logo';
import { initialsOf } from '../shared/presentation/format';
import { visibleModules } from './app-modules';

/**
 * Frame of every signed-in page. There is no navigation bar: the home page offers the modules, the
 * logo goes back to it, and the account (initials avatar) holds who you are and the sign-out button.
 */
@Component({
  selector: 'app-staff-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ChipComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeOnOutsideClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    <div class="frame">
      <span class="shape shape--orange" aria-hidden="true"></span>
      <span class="shape shape--blue" aria-hidden="true"></span>
      <span class="shape shape--peach" aria-hidden="true"></span>
      <span class="shape shape--sky" aria-hidden="true"></span>
      <div class="page">
      <header class="top">
        <a routerLink="/inicio" class="brand" aria-label="Ir al inicio"><app-logo /></a>
        <div class="right">
        <nav class="nav" aria-label="Principal">
          <a routerLink="/inicio" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Inicio</a>
          @for (module of modules(); track module.title) {
            @if (module.link) {
              <a [routerLink]="module.link" routerLinkActive="active">{{ module.title }}</a>
            }
          }
        </nav>
        <div class="account" #account>
          <button
            class="avatar"
            type="button"
            aria-haspopup="menu"
            aria-label="Cuenta de usuario"
            [attr.aria-expanded]="open()"
            (click)="open.set(!open())"
          >
            {{ initials() }}
          </button>
          @if (open()) {
            <div class="menu" role="menu">
              <div class="who">
                <strong>{{ name() }}</strong>
                @if (email(); as mail) {
                  <span class="muted small">{{ mail }}</span>
                }
              </div>
              <div class="row">
                @for (role of roles(); track role) {
                  <app-chip>{{ roleLabel(role) }}</app-chip>
                }
              </div>
              <button class="btn btn--small" type="button" role="menuitem" (click)="signOut()">
                Cerrar sesión
              </button>
            </div>
          }
        </div>
        </div>
      </header>
      <main class="content">
        <router-outlet />
      </main>
      </div>
    </div>
  `,
  styles: `
    /* One continuous page: warm to cool, with the same soft orange and blue shapes as the patient portal. */
    .frame {
      position: relative;
      min-height: 100vh;
      overflow: hidden;
      background: linear-gradient(180deg, #fff4ea 0%, #fff 18%, #f4f8fd 55%, #e8effa 100%);
    }
    .shape {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    .shape--orange {
      left: -140px;
      top: -160px;
      width: 460px;
      height: 460px;
      background: #fed7aa;
      opacity: 0.55;
    }
    .shape--blue {
      right: -120px;
      top: -120px;
      width: 380px;
      height: 380px;
      background: var(--blue-soft);
      opacity: 0.8;
    }
    .shape--peach {
      right: -180px;
      top: 42%;
      width: 420px;
      height: 420px;
      background: #ffd9b8;
      opacity: 0.45;
    }
    .shape--sky {
      left: -200px;
      bottom: -120px;
      width: 460px;
      height: 460px;
      background: var(--blue-soft);
      opacity: 0.7;
    }
    .page {
      position: relative;
      max-width: 1272px;
      margin: 0 auto;
      padding: 22px 24px 48px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .right {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .nav {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .nav a {
      padding: 10px 16px;
      border-radius: 999px;
      color: #334155;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
    }
    .nav a:hover {
      color: var(--orange);
    }
    .nav a.active {
      background: #fff;
      color: var(--orange);
      box-shadow: 0 6px 16px rgb(18 55 111 / 10%);
    }
    .brand {
      text-decoration: none;
    }
    .account {
      position: relative;
    }
    .avatar {
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 50%;
      background: var(--blue);
      color: #fff;
      font: inherit;
      font-weight: 800;
      font-size: 15px;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 8px 18px rgb(29 86 166 / 30%);
    }
    .menu {
      position: absolute;
      right: 0;
      top: calc(100% + 10px);
      z-index: 20;
      min-width: 260px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: var(--surface);
      border: 1px solid var(--blue-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
    }
    .who {
      display: flex;
      flex-direction: column;
      color: var(--ink);
    }
    @media (max-width: 860px) {
      .page {
        padding: 16px 16px 32px;
      }
    }
  `,
})
export class StaffShell {
  private readonly session = inject(SessionState);
  private readonly router = inject(Router);
  private readonly account = viewChild<ElementRef<HTMLElement>>('account');

  protected readonly open = signal(false);
  /** `/me` carries no name, so an administrator's own account is looked up in the accounts list. */
  private readonly fullName = signal<string | null>(null);

  protected readonly modules = () => visibleModules((permission) => this.session.can(permission));
  protected readonly roles = () => this.session.user()?.roles ?? [];
  protected readonly roleLabel = (role: string) => ROLE_LABELS[role] ?? role;
  protected readonly email = () => this.session.user()?.email ?? null;
  protected readonly name = computed(() => this.fullName() ?? this.email() ?? 'Tu cuenta');
  protected readonly initials = computed(() => initialsOf(this.name()));

  constructor() {
    // Any way the session ends (button, expiry, a 401 from the API) lands on the login page.
    effect(() => {
      if (this.session.isSignedIn()) return;
      const expired = this.session.endReason() === 'expirada';
      void this.router.navigate(['/login'], { queryParams: expired ? { motivo: 'expirada' } : {} });
    });

    const id = this.session.user()?.id;
    if (id && this.session.can(PERMISSIONS.usersAdmin)) {
      inject(ListUsers)
        .execute()
        .then((users) => {
          const me = users.find((user) => user.id === id);
          if (me) this.fullName.set(`${me.firstName} ${me.lastName}`.trim());
        })
        .catch(() => undefined);
    }
  }

  protected closeOnOutsideClick(event: Event): void {
    if (!this.account()?.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  protected signOut(): void {
    this.session.signOut('cerrada');
  }
}
