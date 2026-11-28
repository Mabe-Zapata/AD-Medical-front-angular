import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { PERMISSIONS } from '../../auth/domain/policies/staff-access';
import { SessionState } from '../../auth/presentation/session.state';
import { Crumb } from '../../../shared/presentation/molecules/breadcrumbs';
import { PageHeaderComponent } from '../../../shared/presentation/organisms/page-header';
import { DraftsState } from './drafts.state';

/** Frame of the knowledge area: title, tabs and the active page. Same look as the home page. */
@Component({
  selector: 'app-knowledge-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header area="Conocimiento clínico" title="Conocimiento clínico" [crumbs]="crumbs">
      <p lede class="muted">
        @if (canSeeRules) {
          Analitos, rangos de referencia y reglas que usa el motor de propuestas preliminares. Nunca
          emite un diagnóstico.
        } @else {
          Los analitos y sus rangos de referencia validados.
        }
      </p>
      <nav tabs class="tabs" aria-label="Secciones del conocimiento clínico">
        <a routerLink="analitos" routerLinkActive="active">Analitos</a>
        @if (canSeeRules) {
          <a routerLink="reglas" routerLinkActive="active">Reglas</a>
        }
        @if (canSeeDrafts) {
          <a routerLink="revision" routerLinkActive="active">Revisión</a>
          <a routerLink="borradores" routerLinkActive="active">
            Borradores
            @if (drafts.drafts().length > 0) {
              <span class="count">{{ drafts.drafts().length }}</span>
            }
          </a>
        }
      </nav>
    </app-page-header>
    <router-outlet />
  `,
  styles: `
    /* Section tabs: the same pills as the main navigation, on a white rail. */
    .tabs {
      align-self: flex-start;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px;
      border-radius: 999px;
      background: rgb(255 255 255 / 80%);
      box-shadow: 0 10px 24px rgb(18 55 111 / 8%);
    }
    .tabs a {
      padding: 9px 18px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 14px;
      color: #334155;
      text-decoration: none;
    }
    .tabs a:hover {
      color: var(--orange);
    }
    .tabs a.active {
      background: var(--blue-deep);
      color: #fff;
    }
    .count {
      margin-left: 6px;
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--orange);
      color: #fff;
      font-size: 11px;
    }
  `,
})
export class KnowledgeLayout {
  protected readonly drafts = inject(DraftsState);
  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Conocimiento clínico' },
  ];
  private readonly session = inject(SessionState);
  /** Only what the role can use is offered: rules belong to the administrator, review and drafts to who validates. */
  protected readonly canSeeRules = this.session.can(PERMISSIONS.knowledgeAdmin);
  protected readonly canSeeDrafts =
    this.session.can(PERMISSIONS.knowledgeValidate) || this.session.can(PERMISSIONS.knowledgeAdmin);
}
