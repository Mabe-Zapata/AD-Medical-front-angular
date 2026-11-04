import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
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
        <input
          id="email"
          class="input"
          type="email"
          autocomplete="username"
          formControlName="email"
        />
        @if (form.controls.email.touched && form.controls.email.invalid) {
          <span class="field-error">Escribe un correo válido.</span>
        }
      </div>
      <div class="field">
        <label for="password">Contraseña</label>
        <input
          id="password"
          class="input"
          type="password"
          autocomplete="current-password"
          formControlName="password"
        />
        @if (form.controls.password.touched && form.controls.password.invalid) {
          <span class="field-error">Escribe tu contraseña.</span>
        }
      </div>
      <button class="btn btn--primary" type="submit" [disabled]="busy()">
        @if (busy()) {
          <span class="spinner" aria-hidden="true"></span> Verificando…
        } @else {
          Iniciar sesión
        }
      </button>
    </form>
  `,
})
export class LoginFormComponent {
  readonly busy = input(false);
  readonly submitted = output<Credentials>();

  private readonly fb = inject(NonNullableFormBuilder);
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
