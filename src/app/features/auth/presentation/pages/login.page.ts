import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { APP_SETTINGS } from '../../../../core/config/app-settings';
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
      <div class="shell">
        <aside class="brand">
          <span class="orb orb--top" aria-hidden="true"></span>
          <span class="orb orb--ring" aria-hidden="true"></span>
          <span class="orb orb--bottom" aria-hidden="true"></span>
          <span class="dots" aria-hidden="true"></span>

          <div class="brand-logo"><app-logo [inverse]="true" /></div>

          <div class="pitch">
            <span class="tag">Sistema interno</span>
            <h2>Todo el laboratorio, en un solo lugar.</h2>
            <p>Cada persona ve solo lo que puede usar.</p>
          </div>

          <ul class="roles">
            <li>
              <span class="icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 3v6a4 4 0 008 0V3M12 13v4a4 4 0 008 0v-1" />
                  <circle cx="20" cy="14" r="2" />
                </svg>
              </span>
              <span>
                <strong>Médicos</strong>
                <small>Revisan la propuesta y registran su decisión</small>
              </span>
            </li>
            <li>
              <span class="icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" />
                </svg>
              </span>
              <span>
                <strong>Laboratorio</strong>
                <small>Registra los resultados de cada prueba</small>
              </span>
            </li>
            <li>
              <span class="icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="9" cy="8" r="3" />
                  <path d="M3 20c.6-3.2 3-5 6-5s5.4 1.8 6 5M17 11l2 2 3-4" />
                </svg>
              </span>
              <span>
                <strong>Administración</strong>
                <small>Gestiona cuentas, roles y conocimiento clínico</small>
              </span>
            </li>
          </ul>

          <p class="secure">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
            </svg>
            Sesión segura: se cierra a los 15 minutos
          </p>
        </aside>

        <section class="form">
          <p class="eyebrow"><span class="bar"></span>Acceso del personal</p>
          <h1>Iniciar sesión</h1>
          <p class="muted lead-text">Acceso para médicos, laboratoristas y administradores.</p>

          @if (expired) {
            <app-banner tone="warning">Tu sesión expiró. Inicia sesión de nuevo.</app-banner>
          }
          @if (error(); as e) {
            <app-banner tone="danger">
              {{ e.message }}
            </app-banner>
          }

          <app-login-form [busy]="busy()" (submitted)="onSubmit($event)" />

          @if (portalUrl) {
            <a class="patient" [href]="portalUrl">
              <span class="icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" />
                </svg>
              </span>
              <span class="text">
                <strong>¿Eres paciente?</strong>
                <small>Tus citas y resultados están en el portal del paciente.</small>
              </span>
              <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          } @else {
            <p class="patient patient--plain">
              <strong>¿Eres paciente?</strong> Usa el portal del paciente.
            </p>
          }
        </section>
      </div>
    </main>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .wrap {
      position: relative;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      overflow: hidden;
      background: linear-gradient(135deg, #eef3fb 0%, #f5f8fd 45%, #fde9da 100%);
    }
    .wrap::before,
    .wrap::after {
      content: '';
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    .wrap::before {
      left: -140px;
      top: -160px;
      width: 520px;
      height: 520px;
      background: radial-gradient(circle, rgb(29 86 166 / 16%) 0%, transparent 70%);
    }
    .wrap::after {
      right: -120px;
      bottom: -180px;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgb(194 65 12 / 20%) 0%, transparent 70%);
    }

    .shell {
      position: relative;
      z-index: 1;
      width: min(1060px, 100%);
      min-height: 640px;
      display: flex;
      border-radius: 28px;
      background: #fff;
      overflow: hidden;
      box-shadow:
        0 40px 80px rgb(18 55 111 / 20%),
        0 8px 20px rgb(18 55 111 / 10%);
    }

    /* Brand panel */
    .brand {
      position: relative;
      flex: 0 0 46%;
      box-sizing: border-box;
      padding: 40px 40px 32px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: #fff;
      background: linear-gradient(160deg, #c2410c 0%, #c84a0b 55%, #9a3412 100%);
    }
    .orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    .orb--top {
      right: -110px;
      top: -110px;
      width: 340px;
      height: 340px;
      background: rgb(255 255 255 / 8%);
    }
    .orb--ring {
      right: -30px;
      top: -30px;
      width: 180px;
      height: 180px;
      border: 1px solid rgb(255 255 255 / 22%);
    }
    .orb--bottom {
      left: -90px;
      bottom: -120px;
      width: 320px;
      height: 320px;
      background: rgb(18 55 111 / 28%);
    }
    .dots {
      position: absolute;
      inset: 0;
      opacity: 0.55;
      pointer-events: none;
      background-image: radial-gradient(rgb(255 255 255 / 14%) 1.2px, transparent 1.2px);
      background-size: 22px 22px;
    }
    .brand > :not(.orb, .dots) {
      position: relative;
    }
    .brand-logo {
      display: flex;
    }
    .pitch {
      margin-top: 40px;
    }
    .tag {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgb(255 255 255 / 20%);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .pitch h2 {
      margin: 16px 0 0;
      font-size: 34px;
      line-height: 1.12;
      font-weight: 800;
      color: #fff;
    }
    .pitch p {
      margin: 12px 0 0;
      font-size: 15px;
      line-height: 1.5;
      color: rgb(255 255 255 / 92%);
    }
    .roles {
      list-style: none;
      margin: 28px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .roles li {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgb(255 255 255 / 14%);
      border: 1px solid rgb(255 255 255 / 22%);
    }
    .roles .icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: rgb(255 255 255 / 20%);
    }
    .roles svg {
      width: 20px;
      height: 20px;
      stroke: #fff;
      stroke-width: 2;
    }
    .roles strong {
      display: block;
      font-size: 14.5px;
      font-weight: 800;
    }
    .roles small {
      display: block;
      font-size: 12.5px;
      color: rgb(255 255 255 / 90%);
    }
    .secure {
      margin: auto 0 0;
      padding-top: 14px;
      border-top: 1px solid rgb(255 255 255 / 25%);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .secure svg {
      width: 16px;
      height: 16px;
      stroke: #fff;
      stroke-width: 2;
    }

    /* Form */
    .form {
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
      padding: 40px 56px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 18px;
    }
    .eyebrow {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: var(--orange-deep);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .bar {
      width: 18px;
      height: 2px;
      background: var(--orange);
    }
    .form h1 {
      margin: -8px 0 0;
      font-size: 34px;
      font-weight: 800;
    }
    .lead-text {
      margin: -12px 0 6px;
      font-size: 14.5px;
    }
    .patient {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 8px;
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--blue-tint);
      border: 1px solid var(--blue-soft);
      color: var(--blue-deep);
      text-decoration: none;
    }
    a.patient:hover {
      background: #e4ecf8;
    }
    .patient--plain {
      display: block;
      font-size: 13.5px;
    }
    .patient .icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #fff;
    }
    .patient .icon svg {
      width: 20px;
      height: 20px;
      stroke: var(--blue);
      stroke-width: 2;
    }
    .patient .text {
      flex: 1;
    }
    .patient strong {
      display: block;
      font-size: 14px;
      font-weight: 800;
    }
    .patient small {
      display: block;
      font-size: 12.5px;
      color: var(--blue-text);
    }
    .patient .arrow {
      width: 18px;
      height: 18px;
      stroke: var(--blue);
      stroke-width: 2.4;
    }

    /* Phone and small tablets: the brand becomes a curved header and the form a card over it. */
    @media (max-width: 880px) {
      .wrap {
        padding: 0;
        place-items: stretch;
        background: var(--page);
      }
      .wrap::before,
      .wrap::after {
        display: none;
      }
      .shell {
        width: 100%;
        min-height: 100vh;
        flex-direction: column;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        overflow: visible;
      }
      .brand {
        flex: none;
        padding: 28px 24px 84px;
        border-radius: 0 0 36px 36px;
      }
      .pitch {
        margin-top: 24px;
      }
      .pitch h2 {
        font-size: 26px;
      }
      .pitch p,
      .roles,
      .secure {
        display: none;
      }
      .form {
        position: relative;
        flex: none;
        margin: -56px 16px 24px;
        padding: 24px 20px 20px;
        border-radius: 24px;
        background: #fff;
        box-shadow:
          0 24px 48px rgb(18 55 111 / 16%),
          0 6px 14px rgb(18 55 111 / 8%);
      }
      .form h1 {
        font-size: 28px;
      }
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
  protected readonly portalUrl =
    inject(APP_SETTINGS, { optional: true })?.patientPortalUrl ?? null;

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
