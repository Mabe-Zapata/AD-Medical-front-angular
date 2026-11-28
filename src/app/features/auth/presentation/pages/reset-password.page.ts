import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import Swal, { type SweetAlertOptions } from 'sweetalert2';

import { AppError } from '../../../../core/domain/app-error';
import { describeError, ErrorView } from '../../../../shared/presentation/error-message';
import { LogoComponent } from '../../../../shared/presentation/atoms/logo';
import { ActivationStatus, AuthRepository } from '../../domain/ports/auth.ports';
import { missingPasswordRequirements, MIN_PASSWORD_LENGTH, passwordStrength } from '../../domain/policies/password-strength';

type RefusedLink = Exclude<ActivationStatus, 'VALID'>;

/** What the person reads when a link cannot be used. The login page shows it after the redirect. */
const REFUSAL_ALERTS: Record<RefusedLink, SweetAlertOptions> = {
  USED: {
    icon: 'warning',
    title: 'Este enlace ya fue usado',
    text: 'Si ya cambiaste tu contraseña, inicia sesión con la nueva.',
    confirmButtonText: 'Entendido',
  },
  EXPIRED: {
    icon: 'warning',
    title: 'Este enlace venció',
    text: 'Pide un enlace nuevo desde «Recupera tu contraseña».',
    confirmButtonText: 'Entendido',
  },
  INVALID: {
    icon: 'error',
    title: 'El enlace no es válido',
    text: 'Abre el enlace completo que llegó a tu correo.',
    confirmButtonText: 'Entendido',
  },
};

/** Public page reached from the activation email: the person chooses their own password here. */
@Component({
  selector: 'app-reset-password-page',
  imports: [LogoComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <section class="card">
        <app-logo />
        @if (done()) {
          <h1>Contraseña actualizada</h1>
          <p class="lead">Ya puedes entrar con tu correo y tu contraseña nueva.</p>
          <a class="btn btn--primary" routerLink="/login">Ir a iniciar sesión</a>
        } @else if (missingToken) {
          <h1>Enlace incompleto</h1>
          <p class="lead">Abre el enlace completo que llegó a tu correo.</p>
        } @else if (checking()) {
          <h1>Crea tu contraseña nueva</h1>
          <p class="lead">Revisando tu enlace…</p>
        } @else {
          <h1>Crea tu contraseña nueva</h1>
          <p class="lead">Define tu contraseña. Debe tener al menos {{ minLength }} caracteres.</p>

          <form class="stack" (submit)="submit($event)" novalidate>
            <label class="field">
              <span>Contraseña nueva</span>
              <span class="input-row">
                <input
                  id="new-password"
                  class="input"
                  [type]="showPassword() ? 'text' : 'password'"
                  autocomplete="new-password"
                  [value]="password()"
                  (input)="password.set(value($event))"
                />
                <button
                  type="button"
                  class="toggle"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  (click)="showPassword.set(!showPassword())"
                >@if (showPassword()) {<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>} @else {<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
              </span>
            </label>
            @if (password()) {
              <div class="strength" aria-live="polite">
                <div class="strength__bar" aria-hidden="true">
                  <span class="strength__fill" [class]="'strength__fill strength__fill--' + strength().tone" [style.width.%]="strength().percent"></span>
                </div>
                <p class="strength__level">Nivel de seguridad: <strong>{{ strength().label }}</strong></p>
                @if (missing().length > 0) {
                  <p class="strength__missing">Te falta: {{ missing().join(', ') }}</p>
                }
              </div>
            }
            <label class="field">
              <span>Repite la contraseña</span>
              <span class="input-row">
                <input
                  id="confirm-password"
                  class="input"
                  [type]="showConfirmation() ? 'text' : 'password'"
                  autocomplete="new-password"
                  [value]="confirmation()"
                  (input)="confirmation.set(value($event))"
                />
                <button
                  type="button"
                  class="toggle"
                  [attr.aria-label]="showConfirmation() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  (click)="showConfirmation.set(!showConfirmation())"
                >@if (showConfirmation()) {<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>} @else {<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
              </span>
            </label>

            @if (error(); as err) {
              <p class="error" role="alert">{{ err.message }}</p>
            }

            <button class="btn btn--primary" type="submit" [disabled]="busy()">
              {{ busy() ? 'Guardando…' : 'Guardar contraseña' }}
            </button>
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
    .input-row { position: relative; display: block; }
    .input { width: 100%; box-sizing: border-box; padding: 10px 76px 10px 12px; border: 1px solid #c9ced8; border-radius: 8px; font: inherit; }
    .toggle { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; padding: 6px; border: 0; border-radius: 6px; background: none; color: #5b6472; cursor: pointer; }
    .toggle:hover { color: #1f6feb; }
    .toggle:focus-visible { outline: 2px solid #1f6feb; outline-offset: 2px; }
    .error { margin: 0; color: #b42318; }
    .strength { display: grid; gap: 6px; }
    .strength__bar { height: 4px; border-radius: 4px; background: #e6e9ef; overflow: hidden; }
    .strength__fill { display: block; height: 100%; border-radius: 4px; transition: width 0.2s; }
    .strength__fill--weak { background: #b42318; }
    .strength__fill--medium { background: #b54708; }
    .strength__fill--strong { background: #067647; }
    .strength__level, .strength__missing { margin: 0; font-size: 0.8rem; color: #5b6472; }
    .btn { padding: 11px 16px; border-radius: 8px; border: 0; font: inherit; cursor: pointer; text-align: center; text-decoration: none; }
    .btn--primary { background: #1f6feb; color: #fff; }
    .btn:disabled { opacity: 0.6; cursor: default; }
  `,
})
export class ResetPasswordPage implements OnInit {
  private readonly auth = inject(AuthRepository);
  private readonly router = inject(Router);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  protected readonly minLength = MIN_PASSWORD_LENGTH;
  protected readonly missingToken = this.token.trim().length === 0;
  protected readonly checking = signal(!this.missingToken);
  protected readonly password = signal('');
  protected readonly confirmation = signal('');
  protected readonly showPassword = signal(false);
  protected readonly showConfirmation = signal(false);
  protected readonly strength = computed(() => passwordStrength(this.password()));
  protected readonly missing = computed(() => missingPasswordRequirements(this.password()));
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<ErrorView | null>(null);

  /** Refuses a used, expired or invalid link before any form is shown: the login page explains why. */
  async ngOnInit(): Promise<void> {
    if (this.missingToken) return;
    try {
      const status = await this.auth.resetStatus(this.token);
      if (status !== 'VALID') {
        await this.refuse(status);
        return;
      }
    } catch {
      // Network trouble: keep the form, submitting reports the problem.
    }
    this.checking.set(false);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const password = this.password();
    const missing = missingPasswordRequirements(password);
    if (missing.length > 0) {
      this.error.set({ message: `Tu contraseña todavía necesita: ${missing.join(', ')}.` });
      return;
    }
    if (password !== this.confirmation()) {
      this.error.set({ message: 'Las contraseñas no coinciden.' });
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.confirmPasswordReset(this.token, password);
      this.password.set('');
      this.confirmation.set('');
      this.done.set(true);
    } catch (error) {
      const code = error instanceof AppError ? error.code : undefined;
      if (code === 'USED' || code === 'EXPIRED' || code === 'INVALID') {
        await this.refuse(code);
        return;
      }
      this.error.set(
        describeError(error, {
          validation: 'No pudimos cambiar tu contraseña. Revisa los datos e inténtalo de nuevo.',
        }),
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** Leaves the page for the login (replacing it, so the back button cannot return here) and explains why. */
  private async refuse(status: RefusedLink): Promise<void> {
    await this.router.navigateByUrl('/login', { replaceUrl: true });
    await Swal.fire(REFUSAL_ALERTS[status]);
  }
}
