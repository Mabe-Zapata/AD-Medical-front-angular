import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../../../core/domain/app-error';
import { SessionState } from '../../../auth/presentation/session.state';
import { OrderSummary, PatientOption, TestTypeOption, WorklistOrder } from '../../domain/entities/orders';
import { ConfirmOrder, CreateOrder, ListOrders, ListPatients, ListTestTypes, ListWorklist } from '../../domain/usecases/orders-usecases';
import { OrdersPage } from './orders.page';

const ORDER_ID = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';
const OTHER_ID = 'aaaaaaaa-0000-4000-8000-000000000002';

const orders: OrderSummary[] = [
  { id: ORDER_ID, patientId: 'aaaaaaaa-0000-4000-8000-000000000010', status: 'COMPLETADA', orderedAt: '2026-11-10T16:30:59Z' },
  { id: OTHER_ID, patientId: 'aaaaaaaa-0000-4000-8000-000000000011', status: 'SOLICITADA', orderedAt: '2026-11-09T10:00:00Z' },
];

/** Plain stub (not vi.fn): vitest flags the rejected promises of mocks as unhandled. */
const patients: PatientOption[] = [
  { id: 'aaaaaaaa-0000-4000-8000-000000000010', name: 'María Pérez' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000011', name: 'Juan Gómez' },
];

const tests: TestTypeOption[] = [
  { id: 'bbbbbbbb-0000-4000-8000-000000000001', code: 'HEM', name: 'Hemograma' },
  { id: 'bbbbbbbb-0000-4000-8000-000000000002', code: 'GLU', name: 'Glucosa' },
];

function setup(
  list: () => Promise<OrderSummary[]>,
  permissions: string[] = ['ordenes.crear'],
  listPatients: () => Promise<PatientOption[]> = async () => patients,
  listWorklist: () => Promise<WorklistOrder[]> = async () => [],
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: SessionState,
        useValue: { can: (permission: string) => permissions.includes(permission), isSignedIn: () => true },
      },
      { provide: ListOrders, useValue: { execute: list } },
      { provide: ListTestTypes, useValue: { execute: async () => tests } },
      { provide: ListWorklist, useValue: { execute: listWorklist } },
      { provide: ConfirmOrder, useValue: { execute: async () => undefined } },
      { provide: ListPatients, useValue: { execute: listPatients } },
      { provide: CreateOrder, useValue: { execute: async () => orders[0] } },
    ],
  });
  const fixture = TestBed.createComponent(OrdersPage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

describe('OrdersPage', () => {
  it('lists the orders with their date and state, each linking to its detail', async () => {
    const { fixture, el } = setup(async () => orders);
    await settle(fixture);

    expect(el.textContent).toContain('10/11/2026');
    expect(el.textContent).toContain('Completada');
    expect(el.textContent).toContain('Solicitada');
    const links = [...el.querySelectorAll<HTMLAnchorElement>('tbody a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual([`/ordenes/${ORDER_ID}`, `/ordenes/${OTHER_ID}`]);
  });

  it('shows the patient name in the orders table', async () => {
    const { fixture, el } = setup(async () => orders);
    await settle(fixture);

    expect(el.textContent).toContain('Paciente');
    expect(el.textContent).toContain('María Pérez');
    expect(el.textContent).toContain('Juan Gómez');
  });

  it('renders order combo box and allows searching by patient name', async () => {
    const { fixture, el } = setup(async () => orders);
    await settle(fixture);

    const select = el.querySelector<HTMLSelectElement>('#order-select');
    const searchInput = el.querySelector<HTMLInputElement>('#order-search');
    expect(select).not.toBeNull();
    expect(searchInput).not.toBeNull();
    expect(select?.value).toBe(ORDER_ID);

    // Summary box reflects the selected order
    expect(el.querySelector('.appointment-summary-box')?.textContent).toContain('María Pérez');
    expect(el.querySelector('.appointment-summary-box')?.textContent).toContain('Completada');

    // Filter by patient Juan
    searchInput!.value = 'Juan';
    searchInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const options = [...select!.querySelectorAll('option')].filter((o) => o.value !== '');
    expect(options).toHaveLength(1);
    expect(options[0].value).toBe(OTHER_ID);
    expect(options[0].textContent).toContain('Juan Gómez');
  });

  it('allows switching between select and manual UUID entry mode', async () => {
    const { fixture, el } = setup(async () => orders);
    await settle(fixture);

    const toggleBtn = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Ingresar identificador UUID manualmente'),
    );
    expect(toggleBtn).not.toBeNull();
    toggleBtn!.click();
    fixture.detectChanges();

    const manualInput = el.querySelector<HTMLInputElement>('input#order-id:not([type="hidden"])');
    expect(manualInput).not.toBeNull();

    const returnBtn = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Volver a seleccionar de la lista'),
    );
    expect(returnBtn).not.toBeNull();
    returnBtn!.click();
    fixture.detectChanges();

    expect(el.querySelector('#order-select')).not.toBeNull();
  });

  it('says there are none when the listing is empty', async () => {
    const { fixture, el } = setup(async () => []);
    await settle(fixture);

    expect(el.textContent).toContain('Todavía no hay órdenes.');
  });

  it('shows no listing at all to a role that cannot list orders, and never asks for it', async () => {
    let asked = 0;
    const { fixture, el } = setup(async () => (asked++, orders), ['resultados.registrar']);
    await settle(fixture);

    expect(asked).toBe(0);
    expect(el.textContent).not.toContain('Mis órdenes');
    expect(el.textContent).not.toContain('Tu rol no ve este listado');
    // The laboratory works from its queue, not from a typed identifier.
    expect(el.querySelector('#order-id')).toBeNull();
    expect(el.textContent).toContain('Cola de trabajo');
  });

  it('treats a 403 as a role that does not see the listing, not as a failure', async () => {
    const { fixture, el } = setup(async () => {
      throw new AppError('forbidden', 'no');
    });
    await settle(fixture);

    expect(el.textContent).not.toContain('Mis órdenes');
    expect(el.textContent).not.toContain('No pudimos cargar');
    expect(el.querySelector('#order-id')).not.toBeNull();
  });

  it('says so when the listing fails for another reason', async () => {
    const { fixture, el } = setup(async () => {
      throw new AppError('unavailable', 'down');
    });
    await settle(fixture);

    expect(el.textContent).toContain('No pudimos cargar las órdenes');
  });

  describe('new order form', () => {
    async function openForm(listPatients?: () => Promise<PatientOption[]>) {
      const ctx = setup(async () => orders, ['ordenes.crear'], listPatients);
      await settle(ctx.fixture);
      [...ctx.el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('Nueva orden'))!.click();
      await settle(ctx.fixture);
      return ctx;
    }

    function type(el: HTMLElement, selector: string, text: string) {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = text;
      input.dispatchEvent(new Event('input'));
    }

    it('narrows the doctor patients as they type, ignoring case and accents', async () => {
      const { fixture, el } = await openForm();
      type(el, '#patient-search', 'maria');
      await settle(fixture);

      const names = [...el.querySelectorAll('#patient-options button')].map((b) => b.textContent?.trim());
      expect(names).toEqual(['María Pérez']);
    });

    it('says the patient does not exist when nothing matches', async () => {
      const { fixture, el } = await openForm();
      type(el, '#patient-search', 'zzz');
      await settle(fixture);

      expect(el.textContent).toContain('No existe ningún paciente con ese nombre.');
    });

    it('does not let emoji into the search or the notes', async () => {
      const { fixture, el } = await openForm();
      type(el, '#patient-search', 'Juan 😀');
      type(el, '#notes', 'urgente 🚑');
      await settle(fixture);

      expect(el.querySelector<HTMLInputElement>('#patient-search')!.value).toBe('Juan ');
      expect(el.querySelector<HTMLInputElement>('#notes')!.value).toBe('urgente ');
    });

    it('asks to pick a patient from the list instead of sending without one', async () => {
      const { fixture, el } = await openForm();
      el.querySelector<HTMLFormElement>('app-modal form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);

      expect(el.textContent).toContain('Elige un paciente de la lista.');
    });

    it('offers the test catalog as checkboxes the doctor can tick', async () => {
      const { fixture, el } = await openForm();

      const boxes = el.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
      expect(boxes).toHaveLength(2);
      expect(el.textContent).toContain('Hemograma');
      boxes[1].click();
      await settle(fixture);
      const after = el.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
      expect([after[0].checked, after[1].checked]).toEqual([false, true]);
    });

    it('asks to tick at least one test before sending', async () => {
      const { fixture, el } = await openForm();
      el.querySelector<HTMLFormElement>('app-modal form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);

      expect(el.textContent).toContain('Marca al menos una prueba.');
    });
  });
});

describe('laboratory queue', () => {
  const urgent: WorklistOrder = {
    id: ORDER_ID,
    origin: 'MEDICO',
    priority: 'URGENTE',
    status: 'SOLICITADA',
    orderedAt: '2026-11-10T16:30:59Z',
    patientName: 'Ana Pérez',
    tests: [
      { detailId: 'd-done', testTypeId: 't1', status: 'COMPLETADO', name: 'Glucosa' },
      { detailId: 'd-pending', testTypeId: 't2', status: 'PENDIENTE', name: 'Hemograma' },
    ],
  };
  const normal: WorklistOrder = {
    id: OTHER_ID,
    origin: 'PACIENTE',
    priority: 'NORMAL',
    status: 'SOLICITADA',
    orderedAt: '2026-11-09T10:00:00Z',
    patientName: 'Juan Gómez',
    tests: [{ detailId: 'd-other', testTypeId: 't3', status: 'PENDIENTE', name: 'Lipidos' }],
  };

  function queueSetup(items: WorklistOrder[], fail = false) {
    return setup(
      async () => orders,
      ['resultados.registrar'],
      undefined,
      async () => {
        if (fail) throw new AppError('unavailable', 'down');
        return items;
      },
    );
  }

  function clickFilter(el: HTMLElement, label: string) {
    [...el.querySelectorAll<HTMLButtonElement>('[role=group] button')]
      .find((b) => b.textContent?.includes(label))!
      .click();
  }

  it('shows the queue with names and urgent orders first, and the filter narrows it', async () => {
    const { fixture, el } = queueSetup([urgent, normal]);
    await settle(fixture);

    const rows = () => [...el.querySelectorAll('.queue-item')].map((row) => row.textContent ?? '');
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toContain('Urgente');
    expect(rows()[0]).toContain('Ana Pérez');
    expect(rows()[1]).toContain('Juan Gómez');
    expect(rows()[0]).toContain('Hemograma');
    expect(rows()[0]).toContain('1 pendiente(s)');
    expect(rows()[1]).toContain('Pedido por el paciente');

    clickFilter(el, 'Urgentes');
    fixture.detectChanges();
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('Hemograma');
  });

  it('opens the order picked from the queue on its pending test', async () => {
    const { fixture, el } = queueSetup([urgent]);
    const router = TestBed.inject(Router);
    const calls: unknown[][] = [];
    router.navigate = ((...args: Parameters<Router['navigate']>) => {
      calls.push(args);
      return Promise.resolve(true);
    }) as Router['navigate'];
    await settle(fixture);

    el.querySelector<HTMLButtonElement>('.queue-item button.btn--primary')!.click();
    await settle(fixture);

    expect(calls).toEqual([[['/ordenes', ORDER_ID], { queryParams: { detalle: 'd-pending' } }]]);
  });

  it('says there are no pending orders when the queue is empty', async () => {
    const { fixture, el } = queueSetup([]);
    await settle(fixture);

    expect(el.textContent).toContain('No hay órdenes pendientes por ahora.');
  });

  it('offers to try again when the queue fails to load', async () => {
    const { fixture, el } = queueSetup([], true);
    await settle(fixture);

    expect(el.textContent).toContain('No pudimos cargar la cola de trabajo.');
    expect(el.textContent).toContain('Reintentar');
  });

  it('is not loaded for a role that cannot record results', async () => {
    let asked = 0;
    const { fixture, el } = setup(async () => orders, ['ordenes.crear'], undefined, async () => (asked++, [urgent]));
    await settle(fixture);

    expect(asked).toBe(0);
    expect(el.querySelector('.queue')).toBeNull();
    expect(el.querySelector('#order-id')).not.toBeNull();
  });
});
