import { signal } from '@angular/core';

/** What a table shows at first, and the sizes the person can choose. */
export const DEFAULT_PAGE_SIZE = 5;
export const PAGE_SIZES: readonly number[] = [5, 10, 20];

/** The page and the page size of one table. A page past the end shows the last one. */
export class PageState {
  readonly page = signal(0);
  readonly size = signal(DEFAULT_PAGE_SIZE);

  slice<T>(items: readonly T[]): T[] {
    const size = this.size();
    const last = Math.max(0, Math.ceil(items.length / size) - 1);
    const start = Math.min(this.page(), last) * size;
    return items.slice(start, start + size);
  }

  setSize(size: number): void {
    this.size.set(size);
    this.page.set(0);
  }
}
