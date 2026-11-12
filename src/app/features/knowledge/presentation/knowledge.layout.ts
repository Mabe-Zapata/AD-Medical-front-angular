import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { DraftsState } from './drafts.state';

/** Frame of the knowledge area: title, tabs and the active page. Same look as the home page. */
@Component({
  selector: 'app-knowledge-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="stack head">
      <a routerLink="/inicio" class="small back">← Volver al resumen</a>
      <div>
        <div class="eyebrow">Medilo · Conocimiento clínico</div>
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
    .back {
      font-weight: 700;
    }
    h1 {
      margin-top: 2px;
      font-size: 32px;
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tabs a {
      padding: 9px 18px;
      border-radius: 999px;
      border: 1px solid var(--blue-soft);
      background: var(--surface);
      font-weight: 700;
      font-size: 14px;
      color: var(--blue-text);
      text-decoration: none;
    }
    .tabs a:hover {
      border-color: var(--orange);
    }
    .tabs a.active {
      background: var(--blue-deep);
      border-color: var(--blue-deep);
      color: #fff;
    }
    .count {
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--orange-tint);
      color: var(--orange-deep);
      font-size: 11px;
    }
  `,
})
export class KnowledgeLayout {
  protected readonly drafts = inject(DraftsState);
}
