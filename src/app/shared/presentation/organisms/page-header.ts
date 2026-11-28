import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BreadcrumbsComponent, Crumb } from '../molecules/breadcrumbs';

/**
 * Presentational: the header every staff screen shares, the one of the clinical knowledge area.
 * The trail says where the person is; the lede explains the screen; tabs and actions are optional.
 */
@Component({
  selector: 'app-page-header',
  imports: [BreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <app-breadcrumbs [items]="crumbs()" />
      <div class="eyebrow">Medilo · {{ area() }}</div>
      <h1>{{ title() }}</h1>
      <ng-content select="[lede]" />
      <ng-content select="[tabs]" />
      <ng-content select="[actions]" />
    </header>
  `,
  styles: `
    .page-head {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 6px 0 0;
    }
  `,
})
export class PageHeaderComponent {
  readonly area = input.required<string>();
  readonly title = input.required<string>();
  readonly crumbs = input.required<readonly Crumb[]>();
}
