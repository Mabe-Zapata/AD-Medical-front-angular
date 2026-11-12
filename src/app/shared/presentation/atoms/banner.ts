import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type Tone = 'info' | 'danger' | 'success' | 'warning';

@Component({
  selector: 'app-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"banner banner--" + tone()',
    '[attr.role]': 'tone() === "danger" ? "alert" : "status"',
  },
  template: `<div class="body"><ng-content /></div>`,
  styles: `
    :host {
      display: block;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid;
      font-size: 13.5px;
    }
    :host(.banner--info) {
      color: var(--info);
      background: var(--blue-tint);
      border-color: var(--blue-soft);
    }
    :host(.banner--danger) {
      color: var(--danger);
      background: rgb(220 38 38 / 8%);
      border-color: rgb(220 38 38 / 35%);
    }
    :host(.banner--success) {
      color: var(--success);
      background: rgb(22 163 74 / 8%);
      border-color: rgb(22 163 74 / 35%);
    }
    :host(.banner--warning) {
      color: var(--warning);
      background: rgb(217 119 6 / 8%);
      border-color: rgb(217 119 6 / 35%);
    }
  `,
})
export class BannerComponent {
  readonly tone = input<Tone>('info');
}
