import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { normalizeSearch, stripEmoji } from '../../../../core/domain/text';
import { formatDate } from '../../../../shared/presentation/format';
import { WorklistOrder } from '../../domain/entities/orders';

const MAX_SHOWN = 6;

/**
 * Presentational: a search box over the laboratory worklist. It narrows as the person types by
 * the order identifier (any part), the origin or the date, and reports the order it picked.
 */
@Component({
  selector: 'app-worklist-picker',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <input
        id="worklist-search"
        class="input mono"
        name="worklistSearch"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="worklist-options"
        [attr.aria-expanded]="open()"
        autocomplete="off"
        maxlength="100"
        placeholder="Escribe parte del identificador, el origen o la fecha"
        [ngModel]="query()"
        (ngModelChange)="type($event)"
        (focus)="open.set(true)"
        (keydown.escape)="open.set(false)"
      />
      @if (open() && state() === 'ready') {
        <ul id="worklist-options" class="options" role="listbox">
          @for (item of matches(); track item.id) {
            <li role="option">
              <button type="button" (click)="pick(item)">
                <span class="mono">Orden {{ shortId(item.id) }}</span>
                <span class="muted small">
                  · {{ originLabel(item.origin) }} · {{ dateOf(item) }} · {{ item.tests.length }} prueba(s)
                </span>
              </button>
            </li>
          } @empty {
            <li class="none" role="option" aria-disabled="true">
              {{ items().length === 0 ? 'No hay órdenes pendientes.' : 'Ninguna orden coincide con esa búsqueda.' }}
            </li>
          }
        </ul>
      }
      @if (state() === 'loading') {
        <span class="hint">Cargando órdenes pendientes…</span>
      } @else if (state() === 'failed') {
        <span class="field-error">No pudimos cargar las órdenes pendientes. Recarga la página.</span>
      }
    </div>
  `,
  styles: `
    .picker {
      position: relative;
    }
    .options {
      position: absolute;
      inset-inline: 0;
      z-index: 5;
      margin: 4px 0 0;
      padding: 4px;
      list-style: none;
      max-height: 240px;
      overflow-y: auto;
      background: #fff;
      border: 1px solid var(--border, #dbe3f0);
      border-radius: 12px;
      box-shadow: 0 12px 28px rgba(15, 30, 60, 0.14);
    }
    .options button {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      width: 100%;
      padding: 10px 12px;
      text-align: left;
      background: none;
      border: 0;
      border-radius: 8px;
      font: inherit;
      cursor: pointer;
    }
    .options button:hover,
    .options button:focus-visible {
      background: var(--blue-tint, #eef3fb);
    }
    .none,
    .hint {
      padding: 10px 12px;
      color: var(--muted, #5b667a);
      font-size: 0.875rem;
    }
  `,
})
export class WorklistPickerComponent {
  readonly items = input.required<readonly WorklistOrder[]>();
  readonly state = input<'loading' | 'ready' | 'failed'>('loading');
  readonly picked = output<WorklistOrder>();

  protected readonly query = signal('');
  protected readonly open = signal(false);

  protected readonly matches = computed(() => {
    const needle = normalizeSearch(this.query()).replace(/-/g, '');
    const found = needle
      ? this.items().filter((item) =>
          [
            item.id.replace(/-/g, ''),
            normalizeSearch(this.originLabel(item.origin)),
            normalizeSearch(this.dateOf(item)),
          ].some((field) => field.includes(needle)),
        )
      : this.items();
    return found.slice(0, MAX_SHOWN);
  });

  protected type(text: string): void {
    this.query.set(stripEmoji(text));
    this.open.set(true);
  }

  protected pick(item: WorklistOrder): void {
    this.query.set(this.shortId(item.id));
    this.open.set(false);
    this.picked.emit(item);
  }

  protected shortId(id: string): string {
    return id.slice(0, 8).toUpperCase();
  }

  protected originLabel(origin: string): string {
    return origin === 'PACIENTE' ? 'Pedido por el paciente' : 'Orden médica';
  }

  protected dateOf(item: WorklistOrder): string {
    return formatDate(item.orderedAt);
  }
}
