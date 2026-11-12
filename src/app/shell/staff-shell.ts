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
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { PERMISSIONS, ROLE_LABELS } from '../features/auth/domain/policies/staff-access';
import { SessionState } from '../features/auth/presentation/session.state';
import { ListUsers } from '../features/users/domain/usecases/users-usecases';
import { ChipComponent } from '../shared/presentation/atoms/chip';
import { LogoComponent } from '../shared/presentation/atoms/logo';
import { initialsOf } from '../shared/presentation/format';

/**
 * Frame of every signed-in page. There is no navigation bar: the home page offers the modules, the
 * logo goes back to it, and the account (initials avatar) holds who you are and the sign-out button.
 */
@Component({
  selector: 'app-staff-shell',
  imports: [RouterOutlet, RouterLink, ChipComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeOnOutsideClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/inicio" class="brand" aria-label="Ir al inicio"><app-logo /></a>
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
      </header>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 32px 48px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
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
      background: var(--gradient);
      color: #fff;
      font: inherit;
      font-weight: 800;
      font-size: 15px;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 6px 14px rgb(194 65 12 / 28%);
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
