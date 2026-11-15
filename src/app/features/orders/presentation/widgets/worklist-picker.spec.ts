import { TestBed } from '@angular/core/testing';

import { WorklistOrder } from '../../domain/entities/orders';
import { WorklistPickerComponent } from './worklist-picker';

const PATIENT_ORDER: WorklistOrder = {
  id: '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11',
  origin: 'PACIENTE',
  priority: 'NORMAL',
  status: 'SOLICITADA',
  orderedAt: '2026-11-10T16:30:59Z',
  tests: [{ detailId: 'd1', testTypeId: 't1', status: 'PENDIENTE' }],
};

const DOCTOR_ORDER: WorklistOrder = {
  id: 'aaaaaaaa-0000-4000-8000-000000000002',
  origin: 'MEDICO',
  priority: 'URGENTE',
  status: 'EN_PROCESO',
  orderedAt: '2026-11-09T10:00:00Z',
  tests: [
    { detailId: 'd2', testTypeId: 't2', status: 'PENDIENTE' },
    { detailId: 'd3', testTypeId: 't3', status: 'PENDIENTE' },
  ],
};

function create(items: readonly WorklistOrder[], state: 'loading' | 'ready' | 'failed' = 'ready') {
  const fixture = TestBed.createComponent(WorklistPickerComponent);
  fixture.componentRef.setInput('items', items);
  fixture.componentRef.setInput('state', state);
  fixture.detectChanges();
  return fixture;
}

function typeInto(fixture: ReturnType<typeof create>, text: string): void {
  const input = fixture.nativeElement.querySelector('#worklist-search') as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function options(fixture: ReturnType<typeof create>): string[] {
  return [...fixture.nativeElement.querySelectorAll('#worklist-options button')].map((b) =>
    ((b as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

/** The identifier label of each shown option, without the details after it. */
function ids(fixture: ReturnType<typeof create>): string[] {
  return options(fixture).map((text) => text.split(' ·')[0]);
}

describe('WorklistPickerComponent', () => {
  it('lists every pending order with its id, origin, date and number of tests', () => {
    const fixture = create([PATIENT_ORDER, DOCTOR_ORDER]);
    typeInto(fixture, ' ');

    const text = options(fixture);
    expect(text).toHaveLength(2);
    expect(text[0]).toContain('Orden 3B9F2A52');
    expect(text[0]).toContain('Pedido por el paciente');
    expect(text[0]).toContain('10/11/2026');
    expect(text[1]).toContain('Orden médica');
    expect(text[1]).toContain('2 prueba(s)');
  });

  it('narrows by a fragment of the identifier, ignoring dashes and case', () => {
    const fixture = create([PATIENT_ORDER, DOCTOR_ORDER]);
    typeInto(fixture, '3B9F-2a');

    expect(ids(fixture)).toEqual(['Orden 3B9F2A52']);
  });

  it('narrows by origin and by date', () => {
    const fixture = create([PATIENT_ORDER, DOCTOR_ORDER]);

    typeInto(fixture, 'medica');
    expect(ids(fixture)).toEqual(['Orden AAAAAAAA']);

    typeInto(fixture, '10/11/2026');
    expect(ids(fixture)).toEqual(['Orden 3B9F2A52']);
  });

  it('says so when no order matches what was typed', () => {
    const fixture = create([PATIENT_ORDER]);
    typeInto(fixture, 'zzz');

    expect(fixture.nativeElement.textContent).toContain('Ninguna orden coincide con esa búsqueda.');
  });

  it('says there are no pending orders when the worklist is empty', () => {
    const fixture = create([]);
    typeInto(fixture, '');

    expect(fixture.nativeElement.textContent).toContain('No hay órdenes pendientes.');
  });

  it('shows the loading and the failed states instead of the list', () => {
    expect(create([PATIENT_ORDER], 'loading').nativeElement.textContent).toContain(
      'Cargando órdenes pendientes',
    );
    expect(create([PATIENT_ORDER], 'failed').nativeElement.textContent).toContain(
      'No pudimos cargar las órdenes pendientes',
    );
  });

  it('never keeps emoji in the search', async () => {
    const fixture = create([PATIENT_ORDER]);
    typeInto(fixture, '3B9F 😀');
    await fixture.whenStable();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#worklist-search') as HTMLInputElement;
    expect(input.value).toBe('3B9F ');
  });

  it('reports the order it picked', () => {
    const fixture = create([PATIENT_ORDER, DOCTOR_ORDER]);
    const picked: WorklistOrder[] = [];
    fixture.componentInstance.picked.subscribe((order) => picked.push(order));
    typeInto(fixture, ' ');

    (fixture.nativeElement.querySelectorAll('#worklist-options button')[1] as HTMLButtonElement).click();

    expect(picked).toEqual([DOCTOR_ORDER]);
  });
});
