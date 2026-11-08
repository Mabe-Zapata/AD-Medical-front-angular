import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Tone } from './banner';

@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"chip chip--" + tone()' },
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
    }
    :host(.chip--info) {
      color: var(--orange-deep);
      background: var(--orange-tint);
    }
    :host(.chip--success) {
      color: var(--success);
      background: rgb(22 163 74 / 12%);
    }
    :host(.chip--warning) {
      color: var(--warning);
      background: rgb(217 119 6 / 12%);
    }
    :host(.chip--danger) {
      color: var(--danger);
      background: rgb(220 38 38 / 12%);
    }
  `,
})
export class ChipComponent {
  readonly tone = input<Tone>('info');
}
