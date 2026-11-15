import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** One step of the trail. Without a link it is the place the person is in now. */
export interface Crumb {
  readonly label: string;
  readonly link?: string;
}

/** Presentational: where the person is, as a trail of links back to each level. */
@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Migas de pan">
      <ol class="crumbs">
        @for (crumb of items(); track $index; let last = $last) {
          <li>
            @if (crumb.link && !last) {
              <a [routerLink]="crumb.link">{{ crumb.label }}</a>
            } @else {
              <span aria-current="page">{{ crumb.label }}</span>
            }
            @if (!last) {
              <span class="sep" aria-hidden="true">›</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: `
    .crumbs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.875rem;
    }
    .crumbs li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .crumbs a {
      color: var(--blue-text, #1d4f91);
      font-weight: 700;
      text-decoration: underline;
    }
    .crumbs [aria-current='page'] {
      font-weight: 600;
    }
    .sep {
      color: var(--muted, #5b667a);
    }
  `,
})
export class BreadcrumbsComponent {
  readonly items = input.required<readonly Crumb[]>();
}
