import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { AppError } from '../../../../core/domain/app-error';
import { SessionState } from '../../../auth/presentation/session.state';
import { ListAnalytes } from '../../../knowledge/domain/usecases/knowledge-usecases';
import { LabOrder, Proposal } from '../../domain/entities/orders';
import {
  DecideProposal,
  EvaluateOrder,
  GetOrder,
  GetProposal,
  ListOrderResults,
  RecordResults,
  ReviewOrder,
  UploadReport,
} from '../../domain/usecases/orders-usecases';
import { OrderDetailPage } from './order-detail.page';

const ORDER_ID = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';
const DETAIL_ID = '8d3c7a11-92b4-4d0b-8e56-0f5d9a3b6c22';
const ANALYTE_ID = 'c1a2b3d4-0000-4000-8000-000000000001';

const baseOrder: LabOrder = {
  id: ORDER_ID,
  patientId: 'p-1',
  priority: 'NORMAL',
  status: 'EN_PROCESO',
  notes: null,
  tests: [{ detailId: DETAIL_ID, testTypeId: 't-1-aaaa-bbbb', status: 'PENDIENTE' }],
};

const order = baseOrder;
const completedOrder: LabOrder = { ...baseOrder, status: 'COMPLETADA' };

const proposal: Proposal = {
  id: 'pr-1',
  orderId: ORDER_ID,
  status: 'PENDIENTE',
  summary: 'Se evaluaron 2 resultados.',
  notice: 'Preliminar',
  engineVersion: 'e5',
  decision: null,
  medicalConclusion: null,
  findings: [
    {
      id: 'h1',
      ruleCode: 'HB-BAJA',
      ruleVersion: 1,
      type: 'HALLAZGO',
      explanation: 'Hemoglobina por debajo del rango.',
      reviewStatus: 'PENDIENTE',
      evidence: [{ resultId: 'r1', observedValue: 9.5, unit: 'g/dL' }],
    },
  ],
};

/** Plain stubs (not vi.fn): vitest flags the rejected promises of mocks as unhandled. */
interface Stubs {
  orderFails: AppError | null;
  order: LabOrder;
  proposal: Proposal | null;
  evaluateFails: AppError | null;
  calls: Record<string, unknown[][]>;
}

function permissions(...granted: string[]) {
  return {
    provide: SessionState,
    useValue: { can: (p: string) => granted.includes(p), isSignedIn: () => true },
  };
}

function setup(stubs: Partial<Stubs>, ...granted: string[]) {
  const state: Stubs = {
    orderFails: null,
    order,
    proposal: null,
    evaluateFails: null,
    calls: {},
    ...stubs,
  };
  const record = (name: string, ...args: unknown[]) => (state.calls[name] ??= []).push(args);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      permissions(...granted),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => ORDER_ID } } } },
      {
        provide: GetOrder,
        useValue: {
          execute: async () => {
            if (state.orderFails) throw state.orderFails;
            return state.order;
          },
        },
      },
      { provide: ListOrderResults, useValue: { execute: async () => [] } },
      { provide: GetProposal, useValue: { execute: async () => state.proposal } },
      {
        provide: ListAnalytes,
        useValue: {
          execute: async () => [
            { id: ANALYTE_ID, name: 'Hemoglobina', unit: 'g/dL', valueType: 'NUMERICO' },
          ],
        },
      },
      {
        provide: RecordResults,
        useValue: { execute: async (...args: unknown[]) => record('record', ...args) },
      },
      { provide: UploadReport, useValue: { execute: async () => ({ fileName: 'x.pdf' }) } },
      {
        provide: EvaluateOrder,
        useValue: {
          execute: async () => {
            if (state.evaluateFails) throw state.evaluateFails;
            state.proposal = proposal;
            return proposal;
          },
        },
      },
      {
        provide: DecideProposal,
        useValue: { execute: async (...args: unknown[]) => record('decide', ...args) },
      },
      {
        provide: ReviewOrder,
        useValue: { execute: async (...args: unknown[]) => record('review', ...args) },
      },
    ],
  });
  const fixture = TestBed.createComponent(OrderDetailPage);
  return { fixture, el: fixture.nativeElement as HTMLElement, state };
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

const DOCTOR = ['ordenes.crear', 'resultados.leer_con_acceso', 'revisiones.registrar'];
const LAB = ['resultados.registrar', 'conocimiento.leer'];

function type(el: HTMLElement, selector: string, value: string, event = 'input') {
  const field = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event(event));
}

describe('OrderDetailPage', () => {
  it('shows the doctor the order and offers the proposal and the review, not the results form', async () => {
    const { fixture, el } = setup({}, ...DOCTOR);
    await settle(fixture);

    expect(el.textContent).toContain('Orden');
    expect(el.textContent).toContain('Generar propuesta preliminar');
    expect(el.textContent).toContain('Revisión médica de la orden');
    expect(el.textContent).toContain('Se habilita cuando todas las pruebas');
    expect(el.querySelector('app-review-form')).toBeNull();
    expect(el.textContent).not.toContain('Registrar resultados');
    expect(el.textContent).not.toContain('Informe en PDF');
  });

  it('generates the proposal and shows its findings with the not-a-diagnosis warning', async () => {
    const { fixture, el } = setup({}, ...DOCTOR);
    await settle(fixture);

    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Generar propuesta'))!
      .click();
    await settle(fixture);

    expect(el.textContent).toContain('Hemoglobina por debajo del rango.');
    expect(el.textContent).toContain('HB-BAJA');
    expect(el.textContent).toContain('No es un diagnóstico');
    expect(el.textContent).toContain('Decisión médica');
  });

  it('explains in Spanish that the order is not complete yet', async () => {
    const { fixture, el } = setup(
      { evaluateFails: new AppError('conflict', 'x', 'c-1') },
      ...DOCTOR,
    );
    await settle(fixture);

    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Generar propuesta'))!
      .click();
    await settle(fixture);

    expect(el.textContent).toContain('todavía no tiene todos sus resultados');
    expect(el.textContent).toContain('c-1');
  });

  it('refuses to reject a proposal without a reason and sends it with one', async () => {
    const { fixture, el, state } = setup({ proposal }, ...DOCTOR);
    await settle(fixture);

    // Options come in the order ACEPTAR, CORREGIR, RECHAZAR; the radio value lives in Angular, not the DOM.
    el.querySelectorAll<HTMLInputElement>('input[type=radio]')[2].click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('app-decision-form button[type=submit]')!.click();
    await settle(fixture);
    expect(state.calls['decide']).toBeUndefined();
    expect(el.textContent).toContain('Escribe el motivo del rechazo.');

    type(el, '#decision-text', 'No corresponde al paciente.');
    el.querySelector<HTMLButtonElement>('app-decision-form button[type=submit]')!.click();
    await settle(fixture);

    expect(state.calls['decide']).toEqual([['pr-1', 'RECHAZAR', 'No corresponde al paciente.']]);
    expect(el.textContent).toContain('Decisión registrada.');
  });

  it('opens the review once every test has its results and sends it', async () => {
    const { fixture, el, state } = setup({ order: completedOrder }, ...DOCTOR);
    await settle(fixture);

    expect(el.querySelector('app-review-form')).not.toBeNull();
    type(el, '#review-conclusion', 'Resultados coherentes con la clínica.');
    el.querySelector<HTMLButtonElement>('app-review-form button[type=submit]')!.click();
    await settle(fixture);

    expect(state.calls['review']).toEqual([
      [ORDER_ID, 'Resultados coherentes con la clínica.', ''],
    ]);
    expect(el.textContent).toContain('Revisión registrada.');
  });

  it('lets the laboratory enter results and hides the proposal', async () => {
    const { fixture, el, state } = setup({}, ...LAB);
    await settle(fixture);

    expect(el.textContent).toContain('Registrar resultados');
    expect(el.textContent).toContain('Informe en PDF');
    expect(el.textContent).not.toContain('Propuesta clínica');
    expect(el.textContent).not.toContain('Revisión médica');

    type(el, '#result-test', DETAIL_ID, 'change');
    type(el, '#analyte-0', ANALYTE_ID, 'change');
    type(el, '#value-0', '13,5');
    el.querySelector<HTMLButtonElement>('app-results-form button[type=submit]')!.click();
    await settle(fixture);

    expect(state.calls['record']).toHaveLength(1);
    const [orderId, detailId, results] = state.calls['record'][0] as [string, string, unknown[]];
    expect([orderId, detailId]).toEqual([ORDER_ID, DETAIL_ID]);
    expect(results).toEqual([
      {
        analyteId: ANALYTE_ID,
        analyteName: 'Hemoglobina',
        unit: 'g/dL',
        numericValue: 13.5,
        textValue: null,
      },
    ]);
    expect(el.textContent).toContain('Resultados registrados.');
  });

  it('lets the laboratory work blind when the order is closed to it, using the test id', async () => {
    const { fixture, el } = setup({ orderFails: new AppError('forbidden', 'x') }, ...LAB);
    await settle(fixture);

    expect(el.textContent).toContain('solo lo ve el médico que la creó');
    expect(el.textContent).not.toContain('No encontramos esa orden');
    expect(el.querySelector('#result-test')?.tagName).toBe('INPUT');
    expect(el.textContent).toContain('Registrar resultados');
  });

  it('tells a doctor without access that the order is not theirs, in Spanish', async () => {
    const { fixture, el } = setup(
      { orderFails: new AppError('forbidden', 'Access denied', 'c-7') },
      ...DOCTOR,
    );
    await settle(fixture);

    expect(el.textContent).toContain('No encontramos esa orden, o no tienes acceso a ella.');
    expect(el.textContent).toContain('c-7');
    expect(el.textContent).not.toContain('Access denied');
  });
});
