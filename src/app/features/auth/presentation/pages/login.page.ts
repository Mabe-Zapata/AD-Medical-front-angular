import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { LogoComponent } from '../../../../shared/presentation/atoms/logo';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { SessionState } from '../session.state';
import { Credentials, LoginFormComponent } from '../widgets/login-form';

/** Only same-site paths are accepted as a destination, so a crafted link cannot send users elsewhere. */
export function safeRedirect(target: string | null): string {
  return target !== null && target.startsWith('/') && !target.startsWith('//') ? target : '/inicio';
}

/** Container: talks to the session and the router; the form itself is presentational. */
@Component({
  selector: 'app-login-page',
  imports: [LoginFormComponent, BannerComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <section class="card panel stack">
        <app-logo />
        <div>
          <p class="eyebrow">Sistema interno</p>
          <h1>Iniciar sesión</h1>
          <p class="muted small">Acceso para médicos, laboratoristas y administradores.</p>
        </div>

        @if (expired) {
          <app-banner tone="warning">Tu sesión expiró. Inicia sesión de nuevo.</app-banner>
        }
        @if (error(); as e) {
          <app-banner tone="danger">
            {{ e.message }}
          </app-banner>
        }

        <app-login-form [busy]="busy()" (submitted)="onSubmit($event)" />

        <p class="muted small">¿Eres paciente? Usa el portal del paciente.</p>
      </section>
    </main>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(600px 300px at 10% 0%, #ffe9d6, transparent),
        radial-gradient(500px 300px at 100% 100%, #fed8ba, transparent), var(--page);
    }
    .panel {
      width: min(440px, 100%);
      padding: 32px;
    }
    .eyebrow {
      color: var(--orange);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
  `,
})
export class LoginPage {
  private readonly session = inject(SessionState);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorView | null>(null);
  protected readonly expired = this.route.snapshot.queryParamMap.get('motivo') === 'expirada';

  protected async onSubmit({ email, password }: Credentials): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.session.signIn(email, password);
      await this.router.navigateByUrl(
        safeRedirect(this.route.snapshot.queryParamMap.get('redirect')),
      );
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
