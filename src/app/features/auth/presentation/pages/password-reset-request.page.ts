import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { describeError, ErrorView } from '../../../../shared/presentation/error-message';
import { LogoComponent } from '../../../../shared/presentation/atoms/logo';
import { AuthRepository } from '../../domain/ports/auth.ports';

/** Public page: asks for a reset link. The answer never says whether the account exists. */
@Component({
  selector: 'app-password-reset-request-page',
  imports: [LogoComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <section class="card">
        <app-logo />
        @if (sent()) {
          <h1>Revisa tu correo</h1>
          <p class="lead">Si la dirección tiene una cuenta activa, te enviamos un enlace para crear una contraseña nueva. Caduca en 1 hora.</p>
          <a class="btn btn--primary" routerLink="/login">Volver a iniciar sesión</a>
        } @else {
          <h1>Recupera tu contraseña</h1>
          <p class="lead">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>
          <form class="stack" (submit)="submit($event)" novalidate>
            <label class="field">
              <span>Correo electrónico</span>
              <input id="reset-email" class="input" type="email" autocomplete="email" [value]="email()" (input)="email.set(value($event))" />
            </label>
            @if (error(); as err) {
              <p class="error" role="alert">{{ err.message }}</p>
            }
            <button class="btn btn--primary" type="submit" [disabled]="busy()">
              {{ busy() ? 'Enviando…' : 'Enviar enlace' }}
            </button>
            <a class="link" routerLink="/login">Volver a iniciar sesión</a>
          </form>
        }
      </section>
    </main>
  `,
  styles: `
    :host { display: block; }
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { width: min(420px, 100%); display: grid; gap: 16px; }
    h1 { margin: 8px 0 0; font-size: 1.5rem; }
    .lead { margin: 0; color: #5b6472; }
    .stack { display: grid; gap: 14px; }
    .field { display: grid; gap: 6px; font-size: 0.9rem; }
    .input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #c9ced8; border-radius: 8px; font: inherit; }
    .error { margin: 0; color: #b42318; }
    .link { text-align: center; color: #1f6feb; text-decoration: none; font-size: 0.9rem; }
    .btn { padding: 11px 16px; border-radius: 8px; border: 0; font: inherit; cursor: pointer; text-align: center; text-decoration: none; }
    .btn--primary { background: #1f6feb; color: #fff; }
    .btn:disabled { opacity: 0.6; cursor: default; }
  `,
})
export class PasswordResetRequestPage {
  private readonly auth = inject(AuthRepository);

  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<ErrorView | null>(null);

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.email().trim();
    if (email.length === 0) {
      this.error.set({ message: 'Escribe el correo de tu cuenta.' });
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.requestPasswordReset(email);
      this.sent.set(true);
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
