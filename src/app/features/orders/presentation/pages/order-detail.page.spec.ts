import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { AppError } from '../../../../core/domain/app-error';
import { SessionState } from '../../../auth/presentation/session.state';
import { ListAnalytes } from '../../../knowledge/domain/usecases/knowledge-usecases';
import { LabOrder, OrderDocument, Proposal } from '../../domain/entities/orders';
import {
  ConfirmOrder,
  DecideProposal,
  DownloadDocument,
  EvaluateOrder,
  GetOrder,
  GetProposal,
  ListOrderDocuments,
  ListOrderResults,
  ListPatients,
  ListTestAnalytes,
  ListTestTypes,
  ListWorklist,
  RecordResults,
  ReviewOrder,
  UploadReport,
} from '../../domain/usecases/orders-usecases';
import {
  EditShadowFinding,
  GetShadowReport,
  ListShadowEdits,
  RecordShadowSnapshot,
} from '../../domain/usecases/shadow-usecases';
import { OrderDetailPage } from './order-detail.page';

const ORDER_ID = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';
const DETAIL_ID = '8d3c7a11-92b4-4d0b-8e56-0f5d9a3b6c22';
const OTHER_DETAIL = '1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b';
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
  reviewFails: AppError | null;
  downloadFails: AppError | null;
  documents: OrderDocument[];
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
    reviewFails: null,
    downloadFails: null,
    documents: [],
    calls: {},
    ...stubs,
  };
  const record = (name: string, ...args: unknown[]) => (state.calls[name] ??= []).push(args);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      permissions(...granted),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: { get: () => ORDER_ID },
            queryParamMap: { get: () => null },
          },
        },
      },
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
      // The shadow panel has its own spec; here it only needs to exist.
      { provide: GetShadowReport, useValue: { execute: async () => ({ findings: [] }) } },
      { provide: RecordShadowSnapshot, useValue: { execute: async () => null } },
      { provide: EditShadowFinding, useValue: { execute: async () => '' } },
      { provide: ListShadowEdits, useValue: { execute: async () => [] } },
      { provide: GetProposal, useValue: { execute: async () => state.proposal } },
      { provide: ListWorklist, useValue: { execute: async () => [] } },
      { provide: ListOrderDocuments, useValue: { execute: async () => state.documents } },
      {
        provide: DownloadDocument,
        useValue: {
          execute: async (...args: unknown[]) => {
            record('download', ...args);
            if (state.downloadFails) throw state.downloadFails;
            return new Blob(['dummy pdf'], { type: 'application/pdf' });
          },
        },
      },
      { provide: ConfirmOrder, useValue: { execute: async () => undefined } },
      { provide: ListPatients, useValue: { execute: async () => [{ id: 'p-1', name: 'Ana López' }] } },
      {
        provide: ListTestTypes,
        useValue: {
          execute: async () => [{ id: 't-1-aaaa-bbbb', code: 'HEM', name: 'Hemograma completo' }],
        },
      },
      {
        provide: ListTestAnalytes,
        useValue: {
          execute: async () => [
            { id: ANALYTE_ID, name: 'Hemoglobina', unit: 'g/dL', valueType: 'NUMERICO', mandatory: false },
          ],
        },
      },
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
        useValue: {
          execute: async (...args: unknown[]) => {
            if (state.reviewFails) throw state.reviewFails;
            record('review', ...args);
          },
        },
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

/** Every form lives in a modal: it only exists after pressing its button. */
async function openModal(
  fixture: { whenStable(): Promise<unknown>; detectChanges(): void },
  el: HTMLElement,
  label: string,
) {
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(label))!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
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
    expect(el.textContent).toContain('Ana López');
    expect(el.textContent).toContain('Hemograma completo (HEM)');
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
    expect(el.textContent).not.toContain('c-1');
  });

  it('renders a download button for each document and triggers download on click', async () => {
    const docId = 'doc-1111-2222';
    const { fixture, el, state } = setup(
      {
        documents: [
          { id: docId, name: 'informe_laboratorio.pdf', sizeBytes: 1024 * 50 },
        ],
      },
      ...DOCTOR,
    );
    await settle(fixture);

    expect(el.textContent).toContain('informe_laboratorio.pdf');
    const downloadBtn = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Descargar'),
    )!;
    expect(downloadBtn).not.toBeNull();

    downloadBtn.click();
    await settle(fixture);

    expect(state.calls['download']).toEqual([[docId]]);
  });

  it('translates document download errors and never shows correlation_id', async () => {
    const docId = 'doc-403-forbidden';
    const { fixture, el } = setup(
      {
        documents: [
          { id: docId, name: 'privado.pdf', sizeBytes: 1024 * 10 },
        ],
        downloadFails: new AppError('forbidden', 'Forbidden document', 'corr-secret-123', 403),
      },
      ...DOCTOR,
    );
    await settle(fixture);

    const downloadBtn = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Descargar'),
    )!;
    downloadBtn.click();
    await settle(fixture);

    expect(el.querySelector('.banner--danger')?.textContent).toContain(
      'No tienes permiso para descargar este documento.',
    );
    expect(el.textContent).not.toContain('corr-secret-123');
  });

  it('refuses to reject a proposal without a reason and sends it with one', async () => {
    const { fixture, el, state } = setup({ proposal }, ...DOCTOR);
    await settle(fixture);

    await openModal(fixture, el, 'Registrar decisión');
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

  it('closes the review form after registering and shows what was written, with no way to add another', async () => {
    const { fixture, el, state } = setup({ order: completedOrder }, ...DOCTOR);
    await settle(fixture);

    expect(el.querySelector('app-review-form')).toBeNull();
    await openModal(fixture, el, 'Registrar revisión');
    expect(el.querySelector('app-review-form')).not.toBeNull();
    type(el, '#review-conclusion', 'Resultados coherentes con la clínica.');
    type(el, '#review-recommendations', 'Repetir en 3 meses.');
    el.querySelector<HTMLButtonElement>('app-review-form button[type=submit]')!.click();
    await settle(fixture);

    expect(state.calls['review']).toEqual([
      [ORDER_ID, 'Resultados coherentes con la clínica.', 'Repetir en 3 meses.'],
    ]);
    expect(el.textContent).toContain('Revisión registrada.');
    expect(el.querySelector('app-review-form')).toBeNull();
    expect(el.textContent).toContain('Resultados coherentes con la clínica.');
    expect(el.textContent).toContain('Repetir en 3 meses.');
    expect(el.textContent).toContain('El sistema admite una sola revisión por orden');
    expect(el.textContent).not.toContain('Registrar revisión');
  });

  it('closes the form too when the server says the order was already reviewed', async () => {
    const { fixture, el } = setup(
      { order: completedOrder, reviewFails: new AppError('conflict', 'x', 'c-3') },
      ...DOCTOR,
    );
    await settle(fixture);

    await openModal(fixture, el, 'Registrar revisión');
    type(el, '#review-conclusion', 'Otra conclusión.');
    el.querySelector<HTMLButtonElement>('app-review-form button[type=submit]')!.click();
    await settle(fixture);

    expect(el.querySelector('app-review-form')).toBeNull();
    expect(el.textContent).toContain('Esta orden ya fue revisada');
    expect(el.textContent).not.toContain('c-3');
  });

  it('lets the laboratory enter results and hides the proposal', async () => {
    const { fixture, el, state } = setup({}, ...LAB);
    await settle(fixture);

    expect(el.textContent).toContain('Registrar resultados');
    expect(el.textContent).toContain('Informe en PDF');
    expect(el.textContent).not.toContain('Propuesta clínica');
    expect(el.textContent).not.toContain('Revisión médica');

    await openModal(fixture, el, 'Registrar resultados');
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
    expect(el.textContent).toContain('Resultado enviado');
  });

  it('lets the laboratory work blind when the order is closed to it, using the test id', async () => {
    const { fixture, el } = setup({ orderFails: new AppError('forbidden', 'x') }, ...LAB);
    await settle(fixture);

    expect(el.textContent).toContain('registra los resultados desde la cola de trabajo');
    expect(el.textContent).not.toContain('No encontramos esa orden');
    await openModal(fixture, el, 'Registrar resultados');
    expect(el.querySelector('#result-test')?.tagName).toBe('SPAN');
    expect(el.textContent).toContain('Registrar resultados');
  });

  it('shows where the laboratory is and a way back to the results', async () => {
    const { fixture, el } = setup({ orderFails: new AppError('forbidden', 'x') }, ...LAB);
    await settle(fixture);

    const trail = el.querySelector('nav[aria-label="Migas de pan"]');
    expect(trail?.textContent).toContain('Inicio');
    expect(trail?.textContent).toContain('Órdenes y resultados');
    const back = [...el.querySelectorAll('a')].find((a) => a.textContent?.includes('Regresar a resultados'));
    expect(back?.getAttribute('href')).toBe('/ordenes');
  });

  it('tells a doctor without access that the order is not theirs, in Spanish', async () => {
    const { fixture, el } = setup(
      { orderFails: new AppError('forbidden', 'Access denied', 'c-7') },
      ...DOCTOR,
    );
    await settle(fixture);

    expect(el.textContent).toContain('No encontramos esa orden, o no tienes acceso a ella.');
    expect(el.textContent).not.toContain('c-7');
    expect(el.textContent).not.toContain('Access denied');
  });

  it('asks before leaving a form with typed values, and keeps them as a draft in this browser', async () => {
    sessionStorage.clear();
    const { fixture, el } = setup({}, ...LAB);
    await settle(fixture);
    await openModal(fixture, el, 'Registrar resultados');
    type(el, '#result-test', DETAIL_ID);
    type(el, '#value-0', '13,5');
    await settle(fixture);

    buttonWith(el, '← Regresar').click();
    await settle(fixture);
    expect(el.textContent).toContain('Tienes cambios sin guardar');

    buttonWith(el, 'Guardar borrador').click();
    await settle(fixture);
    expect(el.textContent).not.toContain('Tienes cambios sin guardar');
    expect(sessionStorage.getItem(`medilo.results-draft.${ORDER_ID}`)).toContain(DETAIL_ID);
    sessionStorage.clear();
  });

  it('leaves at once when nothing was typed', async () => {
    const { fixture, el } = setup({}, ...LAB);
    await settle(fixture);
    await openModal(fixture, el, 'Registrar resultados');

    buttonWith(el, '← Regresar').click();
    await settle(fixture);

    expect(el.textContent).not.toContain('Tienes cambios sin guardar');
    expect(el.querySelector('#result-test')).toBeNull();
  });

  it('discarding drops what was typed and keeps the draft that was already saved', async () => {
    sessionStorage.setItem(
      `medilo.results-draft.${ORDER_ID}`,
      JSON.stringify({ orderId: ORDER_ID, detailId: DETAIL_ID, rows: [{ analyteId: ANALYTE_ID, value: '12', unit: '' }] }),
    );
    const { fixture, el } = setup({}, ...LAB);
    await settle(fixture);
    await openModal(fixture, el, 'Registrar resultados');
    expect(el.textContent).toContain('Recuperamos tu borrador guardado en este navegador.');
    expect((el.querySelector('#result-test') as HTMLSelectElement).value).toBe(DETAIL_ID);

    type(el, '#value-0', '14');
    await settle(fixture);
    buttonWith(el, '← Regresar').click();
    await settle(fixture);
    buttonWith(el, 'Regresar sin guardar').click();
    await settle(fixture);

    expect(el.querySelector('#result-test')).toBeNull();
    expect(sessionStorage.getItem(`medilo.results-draft.${ORDER_ID}`)).toContain(DETAIL_ID);
    sessionStorage.clear();
  });
});

function buttonWith(el: HTMLElement, text: string): HTMLButtonElement {
  return [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text))!;
}

