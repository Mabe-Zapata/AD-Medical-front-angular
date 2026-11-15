import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type DialogTone = 'primary' | 'danger' | 'ghost';

export interface DialogAction {
  readonly label: string;
  readonly value: string;
  readonly tone: DialogTone;
}

/**
 * Presentational: a small decision the person must make, in the look of the app's modals (no
 * outside library). It never closes on its own: the parent reacts to the chosen action.
 */
@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'chosen.emit(dismissValue())' },
  template: `
    <div class="backdrop">
      <section class="dialog" role="alertdialog" aria-modal="true" [attr.aria-labelledby]="'dialog-title'">
        <h2 id="dialog-title">{{ title() }}</h2>
        <p>{{ message() }}</p>
        <div class="actions">
          @for (action of actions(); track action.value; let first = $first) {
            <button
              type="button"
              class="btn"
              [class.btn--primary]="action.tone === 'primary'"
              [class.btn--danger]="action.tone === 'danger'"
              [class.btn--ghost]="action.tone === 'ghost'"
              [attr.autofocus]="first ? '' : null"
              (click)="chosen.emit(action.value)"
            >
              {{ action.label }}
            </button>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      /* Above the two-panel modal (z-index 100): a decision is never hidden behind the form. */
      z-index: 120;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgb(15 30 60 / 45%);
    }
    .dialog {
      width: min(440px, 100%);
      display: grid;
      gap: 12px;
      padding: 24px;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 24px 60px rgb(15 30 60 / 25%);
    }
    h2 {
      margin: 0;
      font-size: 1.25rem;
    }
    p {
      margin: 0;
      color: var(--muted, #5b667a);
    }
    .btn--danger {
      background: #b42318;
      border-color: #b42318;
      color: #fff;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }
  `,
})
export class DialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actions = input.required<readonly DialogAction[]>();
  /** The value sent when the person presses Escape: it must mean "keep what I was doing". */
  readonly dismissValue = input('');
  readonly chosen = output<string>();
}
