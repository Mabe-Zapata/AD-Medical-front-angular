import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppError } from '../../../../core/domain/app-error';
import { SessionState } from '../../../auth/presentation/session.state';
import { OrderSummary } from '../../domain/entities/orders';
import { CreateOrder, ListOrders } from '../../domain/usecases/orders-usecases';
import { OrdersPage } from './orders.page';

const ORDER_ID = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';
const OTHER_ID = 'aaaaaaaa-0000-4000-8000-000000000002';

const orders: OrderSummary[] = [
  { id: ORDER_ID, patientId: 'p1', status: 'COMPLETADA', orderedAt: '2026-11-10T16:30:59Z' },
  { id: OTHER_ID, patientId: 'p1', status: 'SOLICITADA', orderedAt: '2026-11-09T10:00:00Z' },
];

/** Plain stub (not vi.fn): vitest flags the rejected promises of mocks as unhandled. */
function setup(list: () => Promise<OrderSummary[]>, permissions: string[] = ['ordenes.crear']) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: SessionState,
        useValue: { can: (permission: string) => permissions.includes(permission), isSignedIn: () => true },
      },
      { provide: ListOrders, useValue: { execute: list } },
      { provide: CreateOrder, useValue: { execute: async () => orders[0] } },
    ],
  });
  const fixture = TestBed.createComponent(OrdersPage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  await fixture.whenStable();
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
    // Opening by identifier is what the lab technician uses.
    expect(el.querySelector('#order-id')).not.toBeNull();
    expect(el.textContent).toContain('El médico te da el identificador');
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
});
