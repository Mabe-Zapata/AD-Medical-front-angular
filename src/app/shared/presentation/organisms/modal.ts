import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Two-panel modal, the twin of Flutter's `TwoPanelModal`: an orange brand panel that closes with a blue
 * band on the left, the task on the right (a full-screen sheet below 760px). Presentational: the parent
 * owns the open state, renders it with `@if` (so the form inside starts fresh every time) and reacts to
 * `closed`.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (mousedown)="onBackdrop($event)">
      <section class="modal" role="dialog" aria-modal="true" [attr.aria-label]="headline()">
        <aside class="brand">
          <span class="orb orb--top" aria-hidden="true"></span>
          <span class="orb orb--ring" aria-hidden="true"></span>
          <span class="orb orb--sheet" aria-hidden="true"></span>
          <div class="brand-top">
            <span class="tag">{{ tag() }}</span>
            <h2>{{ headline() }}</h2>
            @if (bullets().length > 0) {
              <ul>
                @for (bullet of bullets(); track bullet) {
                  <li>
                    <span class="check" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>
                    </span>
                    <span>{{ bullet }}</span>
                  </li>
                }
              </ul>
            }
          </div>
          <p class="foot"><strong>Personal autorizado</strong><span>Red Medilo Lab</span></p>
        </aside>
        <div class="task">
          <button class="close" type="button" aria-label="Cerrar" (click)="closed.emit()">
            <span aria-hidden="true">×</span>
          </button>
          <div class="body"><ng-content /></div>
        </div>
      </section>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgb(15 23 42 / 60%);
    }
    .modal {
      display: flex;
      width: min(1040px, 100%);
      max-height: min(760px, 100%);
      background: var(--surface);
      border-radius: var(--radius-xl);
      overflow: hidden;
      box-shadow: 0 40px 80px rgb(15 23 42 / 40%);
    }
    .brand {
      position: relative;
      flex: 4;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: #fff;
      background: linear-gradient(160deg, var(--orange) 0%, #c84a0b 55%, var(--orange-deep) 100%);
    }
    .orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    .orb--top {
      right: -110px;
      top: -110px;
      width: 320px;
      height: 320px;
      background: rgb(255 255 255 / 8%);
    }
    .orb--ring {
      right: -30px;
      top: -30px;
      width: 170px;
      height: 170px;
      border: 1px solid rgb(255 255 255 / 22%);
    }
    .orb--sheet {
      display: none;
    }
    .brand-top {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 36px 32px 20px;
      overflow-y: auto;
    }
    .tag {
      align-self: flex-start;
      padding: 8px 14px;
      border-radius: 999px;
      background: var(--blue-soft);
      color: var(--blue-deep);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .brand h2 {
      color: #fff;
      font-size: 30px;
      line-height: 1.12;
    }
    .brand ul {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 14px;
    }
    .brand li {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgb(255 255 255 / 14%);
      border: 1px solid rgb(255 255 255 / 22%);
      line-height: 1.4;
    }
    .check {
      flex: none;
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--blue);
    }
    .check svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: #fff;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* The blue half of the brand: a band that closes the panel. */
    .foot {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 84px;
      margin: 0;
      padding: 0 32px;
      border-top-right-radius: 84px;
      background: var(--blue);
      font-size: 12px;
    }
    .foot strong {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
    }
    .foot span {
      color: var(--blue-soft);
    }
    .task {
      position: relative;
      flex: 6;
      min-width: 0;
      overflow-y: auto;
    }
    .body {
      padding: 32px 36px 28px;
    }
    .close {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 1;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      background: var(--blue-tint);
      color: var(--blue-deep);
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
    }
    @media (max-width: 759px) {
      .backdrop {
        padding: 0;
      }
      .modal {
        flex-direction: column;
        width: 100%;
        height: 100%;
        max-height: none;
        border-radius: 0;
      }
      .brand {
        flex: none;
        border-radius: 0 0 var(--radius-xl) var(--radius-xl);
      }
      .orb--top,
      .orb--ring {
        display: none;
      }
      .orb--sheet {
        display: block;
        right: -50px;
        top: -50px;
        width: 150px;
        height: 150px;
        background: var(--blue);
      }
      .brand-top {
        gap: 10px;
        padding: 16px 64px 22px 20px;
        overflow: visible;
      }
      .brand h2 {
        font-size: 20px;
      }
      .brand ul,
      .foot {
        display: none;
      }
      .task {
        flex: 1;
      }
      .body {
        padding: 20px;
      }
      .close {
        background: rgb(255 255 255 / 25%);
        color: #fff;
      }
    }
  `,
})
export class ModalComponent {
  readonly tag = input.required<string>();
  readonly headline = input.required<string>();
  readonly bullets = input<readonly string[]>([]);
  readonly closed = output<void>();

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
