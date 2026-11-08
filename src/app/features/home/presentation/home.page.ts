import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { BannerComponent } from '../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../shared/presentation/atoms/chip';
import { ROLE_LABELS } from '../../auth/domain/policies/staff-access';
import { SessionState } from '../../auth/presentation/session.state';
import { visibleModules } from '../../../shell/app-modules';

/** Landing page after sign-in: who you are and which modules are ready. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, BannerComponent, ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (noPermission) {
        <app-banner tone="warning">
          Tu rol no tiene acceso a esa sección. Estos son los módulos que sí puedes usar.
        </app-banner>
      }

      <section class="card stack">
        <h1>Bienvenido</h1>
        <div class="row">
          <span class="muted small">Tu rol:</span>
          @for (role of roles(); track role) {
            <app-chip>{{ roleLabel(role) }}</app-chip>
          }
        </div>
        <p class="muted small">
          Los permisos se leen en cada solicitud: si cambian tu rol, el efecto es inmediato.
        </p>
      </section>

      <h2>Módulos</h2>
      <div class="grid">
        @for (module of modules(); track module.title) {
          <article class="card stack" [class.disabled]="!module.link">
            <h3>{{ module.title }}</h3>
            <p class="muted small">{{ module.description }}</p>
            @if (module.link) {
              <a class="btn btn--primary btn--small" [routerLink]="module.link">Abrir</a>
            } @else {
              <app-chip tone="warning">{{ module.pendingNote ?? 'Próximamente' }}</app-chip>
            }
          </article>
        }
      </div>
    </div>
  `,
  styles: `
    .disabled {
      opacity: 0.75;
      box-shadow: none;
    }
    article {
      gap: 10px;
      align-items: flex-start;
    }
  `,
})
export class HomePage {
  private readonly session = inject(SessionState);

  protected readonly noPermission = inject(ActivatedRoute).snapshot.queryParamMap.has('sinPermiso');
  protected readonly roles = () => this.session.user()?.roles ?? [];
  protected readonly roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

  protected readonly modules = () => visibleModules((permission) => this.session.can(permission));
}
