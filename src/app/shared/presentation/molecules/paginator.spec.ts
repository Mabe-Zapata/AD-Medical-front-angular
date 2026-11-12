import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DEFAULT_PAGE_SIZE, PageState } from '../pagination';
import { PaginatorComponent } from './paginator';

@Component({
  imports: [PaginatorComponent],
  template: `<app-paginator [total]="total" [state]="state" />`,
})
class Host {
  total = 12;
  state = new PageState();
}

function render(total: number) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.total = total;
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, state: fixture.componentInstance.state };
}

describe('PageState', () => {
  const items = Array.from({ length: 12 }, (_, i) => i + 1);

  it('shows five rows at first, as the product asks', () => {
    const state = new PageState();

    expect(DEFAULT_PAGE_SIZE).toBe(5);
    expect(state.slice(items)).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows the rest on the last page and never runs past the end', () => {
    const state = new PageState();

    state.page.set(2);
    expect(state.slice(items)).toEqual([11, 12]);
    state.page.set(9);
    expect(state.slice(items)).toEqual([11, 12]);
  });

  it('goes back to the first page when the size changes', () => {
    const state = new PageState();
    state.page.set(2);

    state.setSize(10);

    expect(state.page()).toBe(0);
    expect(state.slice(items)).toHaveLength(10);
  });

  it('an empty list has an empty page', () => {
    expect(new PageState().slice([])).toEqual([]);
  });
});

describe('PaginatorComponent', () => {
  it('is hidden when everything fits on the smallest page', () => {
    const { el } = render(5);

    expect(el.querySelector('nav')).toBeNull();
  });

  it('says which rows are shown and moves between pages', () => {
    const { fixture, el, state } = render(12);
    const next = el.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!;
    const previous = el.querySelector<HTMLButtonElement>('button[aria-label="Página anterior"]')!;

    expect(el.textContent).toContain('Mostrando 1–5 de 12');
    expect(previous.disabled).toBe(true);

    next.click();
    fixture.detectChanges();

    expect(state.page()).toBe(1);
    expect(el.textContent).toContain('Mostrando 6–10 de 12');
  });

  it('the last page ends at the total and has no next page', () => {
    const { fixture, el, state } = render(12);

    state.page.set(2);
    fixture.detectChanges();

    expect(el.textContent).toContain('Mostrando 11–12 de 12');
    expect(el.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!.disabled).toBe(true);
  });

  it('lets the person choose how many rows per page', () => {
    const { fixture, el, state } = render(30);
    const select = el.querySelector<HTMLSelectElement>('select')!;

    select.value = '10';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(state.size()).toBe(10);
    expect(el.textContent).toContain('Mostrando 1–10 de 30');
  });
});
