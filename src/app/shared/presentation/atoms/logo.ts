import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.inverse]': 'inverse()' },
  template: `
    <span class="mark" aria-hidden="true">+</span>
    <span class="name">Medilo</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 12px;
    }
    .mark {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #fff;
      font-size: 24px;
      font-weight: 700;
      background: var(--gradient);
      box-shadow: 0 3px 8px rgb(194 65 12 / 25%);
    }
    .name {
      font-size: 22px;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: -0.02em;
    }
    /* On the orange brand panel: a white mark with an orange plus. */
    :host(.inverse) .mark {
      color: var(--orange);
      background: #fff;
      box-shadow: 0 6px 16px rgb(0 0 0 / 18%);
    }
    :host(.inverse) .name {
      color: #fff;
    }
  `,
})
export class LogoComponent {
  readonly inverse = input(false);
}
