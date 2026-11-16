import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { hasEmoji, isValidEmail, isValidName, sanitizeEmail, sanitizeName, sanitizePassword } from '../../../../core/domain/text';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { ROLE_LABELS } from '../../../auth/domain/policies/staff-access';
import { ASSIGNABLE_ROLES, UserSummary } from '../../domain/entities/users';
import { MIN_PASSWORD_LENGTH, userProblems } from '../../domain/policies/user-policies';
import { CreateUser, ListUsers } from '../../domain/usecases/users-usecases';
import { ModalComponent } from '../../../../shared/presentation/organisms/modal';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { PageState } from '../../../../shared/presentation/pagination';

/** Container: lists the accounts and lets an administrator create one. */
@Component({
  selector: 'app-users-page',
  imports: [FormsModule, BannerComponent, ChipComponent, ModalComponent, PaginatorComponent, PageHeaderComponent],
  styles: `
    .back {
      font-weight: 700;
    }
    .required {
      color: var(--danger, #dc2626);
      font-weight: 700;
      margin-left: 2px;
    }
    .password-wrapper {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .password-wrapper input {
      flex: 1;
    }
    .password-toggle {
      flex-shrink: 0;
      white-space: nowrap;
    }
    .roles-section {
      display: grid;
      gap: 6px;
      margin-top: 4px;
    }
    .roles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
      gap: 8px;
      margin-top: 2px;
    }
    .role-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border: 1px solid var(--border, #dbe3f0);
      border-radius: 10px;
      background: var(--surface-subtle, #f8fafc);
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      font-size: 14px;
      font-weight: 500;
      user-select: none;
    }
    .role-pill:hover {
      border-color: var(--primary, #ea580c);
      background: #fff;
    }
    .role-pill--selected {
      border-color: var(--primary, #ea580c);
      background: #fff7ed;
      color: var(--primary-deep, #9a3412);
      font-weight: 600;
      box-shadow: 0 0 0 1px var(--primary, #ea580c);
    }
    .role-pill input[type="radio"] {
      cursor: pointer;
      accent-color: var(--primary, #ea580c);
      width: 16px;
      height: 16px;
      margin: 0;
    }
    .modal-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-top: 12px;
    }
    .field-error {
      color: var(--danger, #dc2626);
      font-size: 13px;
      font-weight: 500;
      margin-top: 3px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <app-page-header area="Usuarios y roles" title="Usuarios y roles" [crumbs]="crumbs">
        <p lede class="muted">Las cuentas del personal y de pacientes, y quién puede hacer qué.</p>
      </app-page-header>

      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }

      <section class="card stack">
        <div class="row spread">
          <div>
            <h2>Cuentas</h2>
            <p class="muted small">Ordenadas por correo. Nunca se muestran contraseñas.</p>
          </div>
          <button class="btn btn--primary" type="button" (click)="openForm()">Nueva cuenta</button>
        </div>
        @if (listing() === 'loading') {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
        } @else if (listing() === 'failed') {
          <app-banner tone="danger">No pudimos cargar las cuentas.</app-banner>
          <div><button class="btn btn--small" type="button" (click)="reload()">Reintentar</button></div>
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
                @for (user of pager.slice(users()); track user.id) {
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
          <app-paginator [total]="users().length" [state]="pager" />
        }
      </section>

      @if (creating()) {
        <app-modal
          tag="Nueva cuenta"
          headline="Crea una cuenta del personal"
          [bullets]="bullets"
          (closed)="closeForm()"
        >
          @if (error(); as e) {
            <app-banner tone="danger">
              {{ e.message }}
            </app-banner>
          }
          <form class="stack" (ngSubmit)="create()" novalidate>
            <div class="grid-2">
              <div class="field">
                <label for="first-name">
                  <strong>Nombres</strong> <span class="required" aria-hidden="true">*</span>
                </label>
                <input
                  id="first-name"
                  class="input"
                  name="firstName"
                  maxlength="100"
                  placeholder="ej. María Carmen"
                  autocomplete="given-name"
                  [value]="firstName()"
                  (input)="onFirstNameInput($event)"
                />
                @if (firstNameError(); as err) {
                  <span class="field-error">{{ err }}</span>
                }
              </div>
              <div class="field">
                <label for="last-name">
                  <strong>Apellidos</strong> <span class="required" aria-hidden="true">*</span>
                </label>
                <input
                  id="last-name"
                  class="input"
                  name="lastName"
                  maxlength="100"
                  placeholder="ej. Pérez Gómez"
                  autocomplete="family-name"
                  [value]="lastName()"
                  (input)="onLastNameInput($event)"
                />
                @if (lastNameError(); as err) {
                  <span class="field-error">{{ err }}</span>
                }
              </div>
            </div>
            <div class="grid-2">
              <div class="field">
                <label for="email">
                  <strong>Correo electrónico</strong> <span class="required" aria-hidden="true">*</span>
                </label>
                <input
                  id="email"
                  class="input"
                  name="email"
                  type="email"
                  maxlength="255"
                  placeholder="ej. usuario@medilo.lab"
                  autocomplete="email"
                  [value]="email()"
                  (input)="onEmailInput($event)"
                />
                @if (emailError(); as err) {
                  <span class="field-error">{{ err }}</span>
                }
              </div>
              <div class="field">
                <label for="password">
                  <strong>Contraseña inicial</strong> <span class="required" aria-hidden="true">*</span>
                </label>
                <div class="password-wrapper">
                  <input
                    id="password"
                    class="input"
                    [type]="showPassword() ? 'text' : 'password'"
                    autocomplete="new-password"
                    placeholder="Mínimo 12 caracteres..."
                    [value]="password()"
                    (input)="onPasswordInput($event)"
                  />
                  <button
                    type="button"
                    class="btn btn--ghost btn--small password-toggle"
                    (click)="togglePasswordVisibility()"
                    [title]="showPassword() ? 'Ocultar contraseña' : 'Ver contraseña'"
                  >
                    {{ showPassword() ? 'Ocultar' : 'Mostrar' }}
                  </button>
                </div>
                <p class="muted small" style="margin-top: 4px;">Mínimo 12 caracteres (sin emojis).</p>
                @if (passwordError(); as err) {
                  <span class="field-error">{{ err }}</span>
                }
              </div>
            </div>

            <div class="field roles-section">
              <span class="roles-label">
                <strong>Rol de la cuenta</strong> <span class="required" aria-hidden="true">*</span>
              </span>
              <p class="muted small" style="margin: 0;">Selecciona el rol asignado a este usuario.</p>
              <div class="roles-grid" role="radiogroup" aria-label="Rol de la cuenta">
                @for (role of assignable; track role) {
                  <label class="role-pill" [class.role-pill--selected]="selectedRole() === role">
                    <input
                      type="radio"
                      name="userRole"
                      [value]="role"
                      [checked]="selectedRole() === role"
                      (change)="selectRole(role)"
                    />
                    <span>{{ roleLabels[role] }}</span>
                  </label>
                }
              </div>
              @if (rolesError(); as err) {
                <span class="field-error">{{ err }}</span>
              }
            </div>

            <div class="modal-actions">
              <button class="btn btn--primary" type="submit" [disabled]="saving()">
                @if (saving()) {
                  <span class="spinner" aria-hidden="true"></span> Creando…
                } @else {
                  Crear cuenta
                }
              </button>
              <button class="btn btn--ghost" type="button" (click)="closeForm()" [disabled]="saving()">
                Cancelar
              </button>
            </div>
          </form>
        </app-modal>
      }
    </div>
  `,
})
export class UsersPage {
  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Usuarios y roles' },
  ];
  protected readonly pager = new PageState();
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
  protected readonly selectedRole = signal<string>('');
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);
  protected readonly creating = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly bullets = [
    'Una cuenta de médico creada aquí no tiene perfil profesional y no podrá crear órdenes hasta que el backend lo permita.',
    'Las contraseñas nunca se muestran después de crearlas.',
  ];

  constructor() {
    void this.load();
    // The home page's "Crear usuario" lands here with the form already open.
    if (inject(ActivatedRoute).snapshot.queryParamMap.has('nuevo')) this.openForm();
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected onFirstNameChange(val: string): void {
    const sanitized = sanitizeName(val);
    this.firstName.set(sanitized);
  }

  protected onFirstNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = sanitizeName(input.value);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.firstName.set(sanitized);
  }

  protected onLastNameChange(val: string): void {
    const sanitized = sanitizeName(val);
    this.lastName.set(sanitized);
  }

  protected onLastNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = sanitizeName(input.value);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.lastName.set(sanitized);
  }

  protected onEmailChange(val: string): void {
    const sanitized = sanitizeEmail(val);
    this.email.set(sanitized);
  }

  protected onEmailInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = sanitizeEmail(input.value);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.email.set(sanitized);
  }

  protected onPasswordInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const sanitized = sanitizePassword(raw);
    if (sanitized !== raw) {
      (event.target as HTMLInputElement).value = sanitized;
    }
    this.password.set(sanitized);
  }

  protected firstNameError(): string | null {
    if (!this.submitted()) return null;
    const val = this.firstName().trim();
    if (val.length === 0) return 'Escribe los nombres.';
    if (!isValidName(val)) return 'Escribe los nombres (solo letras y espacios, sin números ni emojis).';
    return null;
  }

  protected lastNameError(): string | null {
    if (!this.submitted()) return null;
    const val = this.lastName().trim();
    if (val.length === 0) return 'Escribe los apellidos.';
    if (!isValidName(val)) return 'Escribe los apellidos (solo letras y espacios, sin números ni emojis).';
    return null;
  }

  protected emailError(): string | null {
    if (!this.submitted()) return null;
    const val = this.email().trim();
    if (val.length === 0) return 'Escribe un correo válido.';
    if (!isValidEmail(val)) return 'Escribe un correo válido (ej. usuario@dominio.com, sin emojis).';
    return null;
  }

  protected passwordError(): string | null {
    if (!this.submitted()) return null;
    const val = this.password();
    if (hasEmoji(val)) return 'La contraseña no puede contener emojis.';
    if (val.length < this.minPassword) return `Usa al menos ${this.minPassword} caracteres.`;
    return null;
  }

  protected rolesError(): string | null {
    if (!this.submitted()) return null;
    if (!this.selectedRole()) return 'Elige un rol para el usuario.';
    return null;
  }

  /** A field is flagged only after the first attempt to save. */
  protected problem(field: string): boolean {
    return this.submitted() && this.problems().includes(field);
  }

  protected selectRole(role: string): void {
    this.selectedRole.set(role);
  }

  protected openForm(): void {
    this.error.set(null);
    this.notice.set(null);
    this.showPassword.set(false);
    this.selectedRole.set('');
    this.creating.set(true);
  }

  protected closeForm(): void {
    this.creating.set(false);
    this.showPassword.set(false);
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
      this.selectedRole.set('');
      this.submitted.set(false);
      this.creating.set(false);
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
      roles: this.selectedRole() ? [this.selectedRole()] : [],
    };
  }

  protected reload(): void {
    this.listing.set('loading');
    void this.load();
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
