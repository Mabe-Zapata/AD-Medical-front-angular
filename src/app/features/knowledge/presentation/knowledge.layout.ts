import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { DraftsState } from './drafts.state';

/** Frame of the knowledge area: title, tabs and the active page. */
@Component({
  selector: 'app-knowledge-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="stack head">
      <div>
        <h1>Conocimiento clínico</h1>
        <p class="muted">
          Analitos, rangos de referencia y reglas que usa el motor de propuestas preliminares. Nunca
          emite un diagnóstico.
        </p>
      </div>
      <nav class="tabs" aria-label="Secciones del conocimiento clínico">
        <a routerLink="analitos" routerLinkActive="active">Analitos</a>
        <a routerLink="reglas" routerLinkActive="active">Reglas</a>
        <a routerLink="revision" routerLinkActive="active">Revisión</a>
        <a routerLink="borradores" routerLinkActive="active">
          Borradores
          @if (drafts.drafts().length > 0) {
            <span class="count">{{ drafts.drafts().length }}</span>
          }
        </a>
      </nav>
    </header>
    <router-outlet />
  `,
  styles: `
    .head {
      margin-bottom: 20px;
    }
    .tabs {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--line);
    }
    .tabs a {
      padding: 10px 16px;
      font-weight: 700;
      color: var(--muted);
      border-bottom: 3px solid transparent;
      margin-bottom: -1px;
      text-decoration: none;
    }
    .tabs a.active {
      color: var(--orange-deep);
      border-bottom-color: var(--orange);
    }
    .count {
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--orange-tint);
      font-size: 11px;
    }
  `,
})
export class KnowledgeLayout {
  protected readonly drafts = inject(DraftsState);
}
