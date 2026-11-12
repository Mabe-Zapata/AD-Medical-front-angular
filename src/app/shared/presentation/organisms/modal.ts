import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Two-panel modal, the twin of Flutter's `TwoPanelModal`: brand panel on the left, the task on the
 * right (a full-screen sheet below 760px). Presentational: the parent owns the open state, renders it
 * with `@if` (so the form inside starts fresh every time) and reacts to `closed`.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (mousedown)="onBackdrop($event)">
      <section class="modal" role="dialog" aria-modal="true" [attr.aria-label]="headline()">
        <aside class="brand">
          <span class="tag">{{ tag() }}</span>
          <h2>{{ headline() }}</h2>
          @if (bullets().length > 0) {
            <ul>
              @for (bullet of bullets(); track bullet) {
                <li>{{ bullet }}</li>
              }
            </ul>
          }
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
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 24px 60px rgb(15 23 42 / 40%);
    }
    .brand {
      flex: 4;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 36px 32px 28px;
      color: #fff;
      background: linear-gradient(160deg, var(--orange) 0%, var(--orange-deep) 100%);
    }
    .tag {
      align-self: flex-start;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgb(255 255 255 / 20%);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .brand h2 {
      color: #fff;
      font-size: 28px;
      line-height: 1.15;
    }
    .brand ul {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 20px 0 0;
      list-style: none;
      border-top: 1px solid rgb(255 255 255 / 25%);
      font-size: 14.5px;
    }
    .brand li {
      position: relative;
      padding-left: 18px;
    }
    .brand li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #fff;
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid rgb(255 255 255 / 25%);
      font-size: 12px;
    }
    .foot strong {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
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
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 50%;
      background: var(--line);
      color: var(--text);
      font-size: 22px;
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
        gap: 10px;
        padding: 16px 56px 16px 20px;
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
        background: rgb(255 255 255 / 20%);
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
