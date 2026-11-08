import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { HttpOrdersRepository } from './http-orders.repository';

const ID = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';

describe('HttpOrdersRepository', () => {
  let repository: HttpOrdersRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: '/api/v1', defaultSourceId: null } },
        HttpOrdersRepository,
      ],
    });
    repository = TestBed.inject(HttpOrdersRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps an order from the backend fields', async () => {
    const result = repository.getOrder(ID);
    http.expectOne(`/api/v1/lab/orders/${ID}`).flush({
      id: ID,
      paciente_id: 'p1',
      prioridad: 'URGENTE',
      estado: 'SOLICITADA',
      observaciones: null,
      pruebas: [{ detalle_id: 'd1', tipo_prueba_id: 't1', estado: 'PENDIENTE' }],
    });

    expect(await result).toEqual({
      id: ID,
      patientId: 'p1',
      priority: 'URGENTE',
      status: 'SOLICITADA',
      notes: null,
      tests: [{ detailId: 'd1', testTypeId: 't1', status: 'PENDIENTE' }],
    });
  });

  it('sends the results with the backend names and without blanks', async () => {
    const result = repository.recordResults(ID, 'd1', [
      {
        analyteId: 'a1',
        analyteName: ' Hemoglobina ',
        unit: ' g/dL ',
        numericValue: 13.5,
        textValue: null,
      },
      { analyteId: null, analyteName: 'Color', unit: ' ', numericValue: null, textValue: 'Claro' },
    ]);
    const request = http.expectOne(`/api/v1/lab/orders/${ID}/results`);

    expect(request.request.body).toEqual({
      detalle_id: 'd1',
      resultados: [
        {
          analito_id: 'a1',
          nombre_analito: 'Hemoglobina',
          unidad: 'g/dL',
          valor_numerico: 13.5,
          valor_texto: null,
        },
        {
          analito_id: null,
          nombre_analito: 'Color',
          unidad: null,
          valor_numerico: null,
          valor_texto: 'Claro',
        },
      ],
    });
    request.flush({
      id: ID,
      paciente_id: 'p1',
      prioridad: 'NORMAL',
      estado: 'EN_PROCESO',
      observaciones: null,
      pruebas: [],
    });
    expect((await result).status).toBe('EN_PROCESO');
  });

  it('uploads the report as multipart with the field the backend expects', async () => {
    const file = new File(['%PDF-1.4'], 'informe.pdf', { type: 'application/pdf' });
    const result = repository.uploadReport(ID, file);
    const request = http.expectOne(`/api/v1/lab/orders/${ID}/documents`);

    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('archivo')).toBeInstanceOf(File);
    request.flush({ id: 'doc1', nombre_archivo: 'informe.pdf', tamano_bytes: 8 });
    expect(await result).toEqual({ id: 'doc1', fileName: 'informe.pdf', sizeBytes: 8 });
  });

  it('treats "no proposal yet" (404) as null, not as an error', async () => {
    const result = repository.getProposal(ID);
    http
      .expectOne(`/api/v1/lab/orders/${ID}/proposal`)
      .flush({ detail: 'No proposal' }, { status: 404, statusText: 'Not Found' });

    expect(await result).toBeNull();
  });

  it('still fails on a real error reading the proposal', async () => {
    const result = repository.getProposal(ID);
    http
      .expectOne(`/api/v1/lab/orders/${ID}/proposal`)
      .flush({ detail: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('maps a proposal with its findings and evidence', async () => {
    const result = repository.evaluate(ID);
    http.expectOne(`/api/v1/lab/orders/${ID}/evaluate`).flush({
      id: 'pr1',
      orden_id: ID,
      estado: 'PENDIENTE',
      version_motor: 'e5',
      resumen: 'Resumen',
      aviso: 'Preliminar',
      decision: null,
      conclusion_medica: null,
      hallazgos: [
        {
          id: 'h1',
          regla_codigo: 'HB-BAJA',
          regla_version: 1,
          tipo: 'HALLAZGO',
          explicacion: 'Hemoglobina baja',
          estado_revision: 'PENDIENTE',
          evidencia: [{ resultado_id: 'r1', valor_observado: 9.5, unidad_observada: 'g/dL' }],
        },
      ],
    });

    const proposal = await result;
    expect(proposal.findings[0]).toMatchObject({
      ruleCode: 'HB-BAJA',
      explanation: 'Hemoglobina baja',
    });
    expect(proposal.findings[0].evidence[0]).toEqual({
      resultId: 'r1',
      observedValue: 9.5,
      unit: 'g/dL',
    });
  });

  it('sends only the text that the chosen decision needs', async () => {
    const bodies: unknown[] = [];
    for (const [decision, text] of [
      ['ACEPTAR', ''],
      ['CORREGIR', 'Corregida'],
      ['RECHAZAR', 'No aplica'],
    ] as const) {
      const result = repository.decide('pr1', decision, text);
      const request = http.expectOne('/api/v1/clinical/proposals/pr1/reviews');
      bodies.push(request.request.body);
      request.flush({ id: 'x', decision });
      await result;
    }

    expect(bodies).toEqual([
      { decision: 'ACEPTAR', conclusion_corregida: null, motivo: null },
      { decision: 'CORREGIR', conclusion_corregida: 'Corregida', motivo: null },
      { decision: 'RECHAZAR', conclusion_corregida: null, motivo: 'No aplica' },
    ]);
  });

  it('turns a failure into an AppError with its support code', async () => {
    const result = repository.getOrder(ID);
    http
      .expectOne(`/api/v1/lab/orders/${ID}`)
      .flush(
        { detail: 'Access denied', correlation_id: 'c-9' },
        { status: 403, statusText: 'Forbidden' },
      );

    await expect(result).rejects.toMatchObject({ kind: 'forbidden', correlationId: 'c-9' });
    expect(HttpErrorResponse).toBeDefined();
  });
});
