import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../core/domain/app-error';
import { Sede } from '../../domain/entities/sedes';
import {
  AddOffice,
  CreateSedeWithOffices,
  ListSedes,
  UpdateOffice,
  UpdateSede,
} from '../../domain/usecases/sedes-usecases';
import { SedesPage } from './sedes.page';

const NORTE: Sede = {
  id: 'sede-norte',
  name: 'Sede Norte',
  address: 'Av. del Parque 480',
  active: true,
  offices: [
    { id: 'o1', name: 'Consultorio 1', active: true },
    { id: 'o2', name: 'Consultorio 2', active: false },
  ],
};

const SUR: Sede = { id: 'sede-sur', name: 'Sede Sur', address: null, active: false, offices: [] };

interface Fakes {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  addOffice: ReturnType<typeof vi.fn>;
  updateOffice: ReturnType<typeof vi.fn>;
}

/** Each use case is replaced by a spy; the page only sees the public `execute` of each. */
function provideFakes(fakes: Fakes): void {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: ListSedes, useValue: { execute: fakes.list } },
      { provide: CreateSedeWithOffices, useValue: { execute: fakes.create } },
      { provide: UpdateSede, useValue: { execute: fakes.update } },
      { provide: AddOffice, useValue: { execute: fakes.addOffice } },
      { provide: UpdateOffice, useValue: { execute: fakes.updateOffice } },
    ],
  });
}

function freshFakes(): Fakes {
  return {
    list: vi.fn(async () => [NORTE, SUR]),
    create: vi.fn(async () => ({ sedeId: 'nueva', failedOffices: [] })),
    update: vi.fn(async () => undefined),
    addOffice: vi.fn(async () => 'nuevo-consultorio'),
    updateOffice: vi.fn(async () => undefined),
  };
}

async function render(fakes: Fakes) {
  const fixture = TestBed.createComponent(SedesPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

/** Keys go to the focused element, as in a browser, and bubble up to the page's document listener. */
function press(key: string, init: KeyboardEventInit = {}): void {
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

function dialog(el: HTMLElement): HTMLElement | null {
  return el.querySelector('[role=dialog]');
}

describe('SedesPage', () => {
  let fakes: Fakes;

  beforeEach(() => {
    fakes = freshFakes();
    provideFakes(fakes);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows each sede with its consultorios and the totals', async () => {
    const fixture = await render(fakes);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('2 sucursales');
    expect(el.textContent).toContain('2 consultorios');
    expect(el.textContent).toContain('Sede Norte');
    expect(el.textContent).toContain('Consultorio 1');
    expect(el.textContent).toContain('Sin dirección registrada');
  });

  it('opens the new-sede modal with the N key, and not while typing in the search', async () => {
    const fixture = await render(fakes);
    const el = fixture.nativeElement as HTMLElement;

    press('n');
    fixture.detectChanges();
    expect(dialog(el)?.getAttribute('aria-label')).toContain('Crea una sucursal');

    press('Escape');
    fixture.detectChanges();
    expect(dialog(el)).toBeNull();

    const search = el.querySelector<HTMLInputElement>('#sede-search')!;
    search.focus();
    press('n');
    fixture.detectChanges();
    expect(dialog(el)).toBeNull();
  });

  it('moves the focus to the search field with the slash key', async () => {
    const fixture = await render(fakes);
    press('/');
    expect(document.activeElement?.id).toBe('sede-search');
    fixture.destroy();
  });

  it('creates the sede and its consultorios from the keyboard with Ctrl+Enter', async () => {
    const fixture = await render(fakes);
    const el = fixture.nativeElement as HTMLElement;
    press('n');
    fixture.detectChanges();

    const name = el.querySelector<HTMLInputElement>('#sede-name')!;
    name.value = '  Sede Centro ';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const office = el.querySelector<HTMLInputElement>('#office-input')!;
    office.value = 'Consultorio 1';
    office.dispatchEvent(new Event('input'));
    office.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    const form = el.querySelector('form')!;
    form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    await fixture.whenStable();

    expect(fakes.create).toHaveBeenCalledWith({
      // Leading spaces are dropped while typing; the trailing one is kept until save (the use case trims).
      name: 'Sede Centro ',
      address: '',
      offices: ['Consultorio 1'],
    });
  });

  it('keeps the modal in retry mode when a consultorio fails, naming only the ones missing', async () => {
    fakes.create = vi.fn(async () => ({ sedeId: 'nueva', failedOffices: ['Consultorio 3'] }));
    TestBed.resetTestingModule();
    provideFakes(fakes);
    const fixture = await render(fakes);
    const el = fixture.nativeElement as HTMLElement;
    press('n');
    fixture.detectChanges();
    const name = el.querySelector<HTMLInputElement>('#sede-name')!;
    name.value = 'Sede Centro';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await (fixture.componentInstance as unknown as { submitCreate(): Promise<void> }).submitCreate();
    fixture.detectChanges();

    expect(el.textContent).toContain('Faltan consultorios por crear');
    expect(el.textContent).toContain('Consultorio 3');
    expect(el.textContent).toContain('no pudimos crear 1 consultorio');
  });

  it('explains a deactivation blocked by future bookings in plain Spanish', async () => {
    fakes.update = vi.fn(async () => {
      throw new AppError('conflict', 'There are future appointments', 'cid', 409, 'CITAS_FUTURAS');
    });
    TestBed.resetTestingModule();
    provideFakes(fakes);
    const fixture = await render(fakes);
    const el = fixture.nativeElement as HTMLElement;

    const deactivate = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Desactivar sucursal'))!;
    deactivate.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Tiene citas programadas en alguno de sus consultorios');
    expect(el.textContent).not.toContain('future appointments');
  });

  it('never lets a form submit natively, so the page never reloads with the values in the URL', async () => {
    const fixture = await render(fakes);
    const el = fixture.nativeElement as HTMLElement;
    press('n');
    fixture.detectChanges();
    const submit = new Event('submit', { cancelable: true, bubbles: true });
    el.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it('refuses a duplicate consultorio name in the draft, without an API call', async () => {
    const fixture = await render(fakes);
    const el = fixture.nativeElement as HTMLElement;
    press('n');
    fixture.detectChanges();
    const office = el.querySelector<HTMLInputElement>('#office-input')!;
    for (const value of ['Consultorio 1', 'consultorio 1']) {
      office.value = value;
      office.dispatchEvent(new Event('input'));
      office.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
    }
    expect(el.textContent).toContain('Ese consultorio ya está en la lista.');
    expect(fakes.create).not.toHaveBeenCalled();
  });
});
