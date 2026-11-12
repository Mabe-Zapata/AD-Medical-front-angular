import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { ROLE_LABELS } from '../../../auth/domain/policies/staff-access';
import { ASSIGNABLE_ROLES, UserSummary } from '../../domain/entities/users';
import { MIN_PASSWORD_LENGTH, userProblems } from '../../domain/policies/user-policies';
import { CreateUser, ListUsers } from '../../domain/usecases/users-usecases';

/** Container: lists the accounts and lets an administrator create one. */
@Component({
  selector: 'app-users-page',
  imports: [FormsModule, BannerComponent, ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }

      <section class="card stack">
        <div>
          <h2>Cuentas</h2>
          <p class="muted small">Ordenadas por correo. Nunca se muestran contraseñas.</p>
        </div>
        @if (listing() === 'loading') {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
        } @else if (listing() === 'failed') {
          <app-banner tone="danger">No pudimos cargar las cuentas. Inténtalo de nuevo.</app-banner>
        } @else if (users().length === 0) {
          <p class="empty">Todavía no hay cuentas.</p>
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Roles</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (user of users(); track user.id) {
                  <tr>
                    <td>{{ user.firstName }} {{ user.lastName }}</td>
                    <td>{{ user.email }}</td>
                    <td>
                      @for (role of user.roles; track role) {
                        <app-chip>{{ roleLabels[role] ?? role }}</app-chip>
                      }
                    </td>
                    <td>
                      <app-chip [tone]="user.active ? 'success' : 'warning'">
                        {{ user.active ? 'Activa' : 'Inactiva' }}
                      </app-chip>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <section class="card stack">
        <div>
          <h2>Crear una cuenta</h2>
          <p class="muted small">
            Una cuenta de médico creada aquí no tiene perfil profesional y no podrá crear órdenes
            hasta que el backend lo permita.
          </p>
        </div>
        @if (error(); as e) {
          <app-banner tone="danger">
            {{ e.message }}
            @if (e.supportCode) {
              <span class="small">Código de soporte: {{ e.supportCode }}</span>
            }
          </app-banner>
        }
        <form class="stack" (ngSubmit)="create()" novalidate>
          <div class="grid-2">
            <div class="field">
              <label for="first-name">Nombres</label>
              <input id="first-name" class="input" name="firstName" maxlength="100" [ngModel]="firstName()" (ngModelChange)="firstName.set($event)" />
              @if (problem('firstName')) {
                <span class="field-error">Escribe los nombres.</span>
              }
            </div>
            <div class="field">
              <label for="last-name">Apellidos</label>
              <input id="last-name" class="input" name="lastName" maxlength="100" [ngModel]="lastName()" (ngModelChange)="lastName.set($event)" />
              @if (problem('lastName')) {
                <span class="field-error">Escribe los apellidos.</span>
              }
            </div>
          </div>
          <div class="grid-2">
            <div class="field">
              <label for="email">Correo electrónico</label>
              <input id="email" class="input" name="email" type="email" maxlength="255" autocomplete="off" [ngModel]="email()" (ngModelChange)="email.set($event)" />
              @if (problem('email')) {
                <span class="field-error">Escribe un correo válido.</span>
              }
            </div>
            <div class="field">
              <label for="password">Contraseña inicial</label>
              <input id="password" class="input" type="password" autocomplete="new-password" [value]="password()" (input)="password.set(passwordValue($event))" />
              @if (problem('password')) {
                <span class="field-error">Usa al menos {{ minPassword }} caracteres.</span>
              }
            </div>
          </div>
          <fieldset class="field">
            <legend>Roles</legend>
            <div class="row">
              @for (role of assignable; track role) {
                <label class="row small">
                  <input type="checkbox" [checked]="roles().includes(role)" (change)="toggle(role)" />
                  {{ roleLabels[role] }}
                </label>
              }
            </div>
            @if (problem('roles')) {
              <span class="field-error">Elige al menos un rol.</span>
            }
          </fieldset>
          <div>
            <button class="btn btn--primary" type="submit" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner" aria-hidden="true"></span> Creando…
              } @else {
                Crear cuenta
              }
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class UsersPage {
  private readonly listUsers = inject(ListUsers);
  private readonly createUser = inject(CreateUser);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly assignable = ASSIGNABLE_ROLES;
  protected readonly minPassword = MIN_PASSWORD_LENGTH;

  protected readonly users = signal<readonly UserSummary[]>([]);
  protected readonly listing = signal<'loading' | 'ready' | 'failed'>('loading');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly roles = signal<readonly string[]>([]);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  constructor() {
    void this.load();
  }

  /** The password is bound by value, not by NgModel, so clearing it clears the input at once. */
  protected passwordValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** A field is flagged only after the first attempt to save. */
  protected problem(field: string): boolean {
    return this.submitted() && this.problems().includes(field);
  }

  protected toggle(role: string): void {
    this.roles.update((list) => (list.includes(role) ? list.filter((r) => r !== role) : [...list, role]));
  }

  protected async create(): Promise<void> {
    this.submitted.set(true);
    this.notice.set(null);
    this.error.set(null);
    if (this.problems().length > 0) return;
    this.saving.set(true);
    try {
      await this.createUser.execute(this.draft());
      this.notice.set(`Cuenta creada para ${this.email().trim().toLowerCase()}.`);
      this.email.set('');
      this.password.set('');
      this.firstName.set('');
      this.lastName.set('');
      this.roles.set([]);
      this.submitted.set(false);
      await this.load();
    } catch (error) {
      this.error.set(
        describeError(error, {
          conflict: 'Ya existe una cuenta con ese correo.',
          forbidden: 'Solo un administrador puede crear cuentas.',
        }),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private problems(): string[] {
    return userProblems(this.draft());
  }

  private draft() {
    return {
      email: this.email(),
      password: this.password(),
      firstName: this.firstName(),
      lastName: this.lastName(),
      roles: this.roles(),
    };
  }

  private async load(): Promise<void> {
    try {
      this.users.set(await this.listUsers.execute());
      this.listing.set('ready');
    } catch {
      this.listing.set('failed');
    }
  }
}
