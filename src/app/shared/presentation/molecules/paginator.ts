import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PAGE_SIZES, PageState } from '../pagination';

/** "Mostrando 1–5 de 12", the page size and previous/next. Hidden when everything fits on the smallest page. */
@Component({
  selector: 'app-paginator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > smallest) {
      <nav class="pager" aria-label="Paginación de la tabla">
        <span class="muted small">Mostrando {{ from() }}–{{ to() }} de {{ total() }}</span>
        <div class="row">
          <label class="muted small">
            Por página
            <select
              class="input input--small"
              (change)="state().setSize(+$any($event.target).value)"
              aria-label="Filas por página"
            >
              @for (size of sizes; track size) {
                <option [value]="size" [selected]="size === state().size()">{{ size }}</option>
              }
            </select>
          </label>
          <button
            class="btn btn--small"
            type="button"
            [disabled]="current() === 0"
            (click)="state().page.set(current() - 1)"
            aria-label="Página anterior"
          >
            ‹
          </button>
          <span class="small"
            ><strong>{{ current() + 1 }}</strong> de {{ pages() }}</span
          >
          <button
            class="btn btn--small"
            type="button"
            [disabled]="current() >= pages() - 1"
            (click)="state().page.set(current() + 1)"
            aria-label="Página siguiente"
          >
            ›
          </button>
        </div>
      </nav>
    }
  `,
  styles: `
    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-top: 12px;
    }
    .input--small {
      padding: 4px 8px;
      margin-left: 6px;
      width: auto;
    }
  `,
})
export class PaginatorComponent {
  readonly total = input.required<number>();
  readonly state = input.required<PageState>();

  protected readonly sizes = PAGE_SIZES;
  protected readonly smallest = PAGE_SIZES[0];
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.state().size())));
  protected readonly current = computed(() => Math.min(this.state().page(), this.pages() - 1));
  protected readonly from = computed(() => this.current() * this.state().size() + 1);
  protected readonly to = computed(() => Math.min(this.total(), (this.current() + 1) * this.state().size()));
}
