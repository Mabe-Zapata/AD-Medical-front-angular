import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** Presentational: owns the form controls, reports the credentials, knows nothing about the API. */
@Component({
  selector: 'app-login-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="field">
        <label for="email">Correo electrónico</label>
        <div class="control">
          <svg class="lead" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
          <input
            id="email"
            class="input"
            type="email"
            autocomplete="username"
            placeholder="nombre@laboratorio.com"
            formControlName="email"
          />
        </div>
        @if (form.controls.email.touched && form.controls.email.invalid) {
          <span class="field-error">Escribe un correo válido.</span>
        }
      </div>
      <div class="field">
        <label for="password">Contraseña</label>
        <div class="control">
          <svg class="lead" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
          <input
            id="password"
            class="input input--trail"
            [type]="visible() ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="Tu contraseña"
            formControlName="password"
          />
          <button
            class="eye"
            type="button"
            [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            [attr.aria-pressed]="visible()"
            (click)="visible.set(!visible())"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              @if (visible()) {
                <path d="M4 4l16 16" />
              }
            </svg>
          </button>
        </div>
        @if (form.controls.password.touched && form.controls.password.invalid) {
          <span class="field-error">Escribe tu contraseña.</span>
        }
      </div>
      <button class="btn btn--primary go" type="submit" [disabled]="busy()">
        @if (busy()) {
          <span class="spinner" aria-hidden="true"></span> Verificando…
        } @else {
          Iniciar sesión
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        }
      </button>
    </form>
  `,
  styles: `
    .control {
      position: relative;
    }
    .lead {
      position: absolute;
      left: 16px;
      top: 50%;
      width: 18px;
      height: 18px;
      margin-top: -9px;
      fill: none;
      stroke: #64748b;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
    }
    .control .input {
      height: 50px;
      padding-left: 46px;
      border-radius: 14px;
      border-width: 1.5px;
      background: #f8fafc;
    }
    .control .input:focus {
      background: #fff;
    }
    .input--trail {
      padding-right: 52px;
    }
    .eye {
      position: absolute;
      right: 5px;
      top: 5px;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .eye:hover {
      background: var(--blue-tint);
    }
    .eye svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: #475569;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .go {
      height: 54px;
      margin-top: 6px;
      font-size: 16px;
      gap: 10px;
      box-shadow: 0 14px 28px rgb(194 65 12 / 32%);
    }
    .go svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: #fff;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class LoginFormComponent {
  readonly busy = input(false);
  readonly submitted = output<Credentials>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly visible = signal(false);
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitted.emit(this.form.getRawValue());
  }
}
