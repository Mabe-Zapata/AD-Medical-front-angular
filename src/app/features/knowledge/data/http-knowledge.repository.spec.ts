import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { HttpKnowledgeRepository } from './http-knowledge.repository';

describe('HttpKnowledgeRepository', () => {
  let repository: HttpKnowledgeRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: '/api/v1', defaultSourceId: null } },
        HttpKnowledgeRepository,
      ],
    });
    repository = TestBed.inject(HttpKnowledgeRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps analytes from the backend fields', async () => {
    const result = repository.listAnalytes();
    http.expectOne('/api/v1/knowledge/analytes').flush({
      items: [{ id: 'a1', nombre: 'Hemoglobina', unidad: 'g/dL', tipo_valor: 'NUMERICO' }],
    });
    expect(await result).toEqual([
      { id: 'a1', name: 'Hemoglobina', unit: 'g/dL', valueType: 'NUMERICO' },
    ]);
  });

  it('creates an analyte with the backend field names', async () => {
    const result = repository.createAnalyte({ name: 'Glucosa', unit: null, valueType: 'NUMERICO' });
    const request = http.expectOne('/api/v1/knowledge/analytes');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      nombre: 'Glucosa',
      unidad: null,
      tipo_valor: 'NUMERICO',
    });
    request.flush({ id: 'new-id', estado: 'ACTIVO' });
    expect(await result).toBe('new-id');
  });

  it('asks for the references valid on a date and maps them', async () => {
    const result = repository.listReferences('a1', '2026-11-03');
    const request = http.expectOne((r) => r.url === '/api/v1/knowledge/analytes/a1/references');
    expect(request.request.params.get('fecha')).toBe('2026-11-03');
    request.flush({
      items: [
        {
          id: 'r1',
          version: 2,
          unidad: 'g/dL',
          minimo: 12,
          maximo: 16,
          sexo: 'F',
          edad_min_dias: null,
          edad_max_dias: 36500,
          metodo: null,
          tipo_muestra: 'Suero',
          contexto: null,
          fecha_inicio: '2026-01-01',
          fecha_fin: null,
        },
      ],
    });
    expect(await result).toEqual([
      {
        id: 'r1',
        version: 2,
        unit: 'g/dL',
        min: 12,
        max: 16,
        sex: 'F',
        minAgeDays: null,
        maxAgeDays: 36500,
        method: null,
        sampleType: 'Suero',
        context: null,
        startDate: '2026-01-01',
        endDate: null,
      },
    ]);
  });

  it('sends only the fields the backend accepts when creating a reference draft', async () => {
    const result = repository.createReference('a1', {
      sourceId: 's1',
      unit: 'g/dL',
      min: 12,
      max: 16,
      sex: null,
      minAgeDays: null,
      maxAgeDays: null,
      method: null,
      sampleType: null,
      context: null,
      startDate: '2026-01-01',
      endDate: null,
    });
    const request = http.expectOne('/api/v1/knowledge/analytes/a1/references');
    expect(Object.keys(request.request.body as object).sort()).toEqual(
      [
        'contexto',
        'edad_max_dias',
        'edad_min_dias',
        'fecha_fin',
        'fecha_inicio',
        'fuente_id',
        'maximo',
        'metodo',
        'minimo',
        'sexo',
        'tipo_muestra',
        'unidad',
      ].sort(),
    );
    request.flush({ id: 'r-new', estado: 'BORRADOR' });
    expect(await result).toBe('r-new');
  });

  it('creates a rule with its criteria', async () => {
    const result = repository.createRule({
      code: 'R1',
      name: 'Regla',
      description: null,
      type: 'ALERTA',
      logic: 'CUALQUIERA',
      message: 'm',
      priority: 'URGENTE',
      criteria: [{ analyteId: 'a1', operator: 'GE', threshold: 7, unit: 'mg/dL' }],
    });
    const request = http.expectOne('/api/v1/knowledge/rules');
    expect(request.request.body).toEqual({
      codigo: 'R1',
      nombre: 'Regla',
      descripcion: null,
      tipo: 'ALERTA',
      expresion_logica: 'CUALQUIERA',
      mensaje: 'm',
      prioridad: 'URGENTE',
      criterios: [{ analito_id: 'a1', operador: 'GE', umbral: 7, unidad: 'mg/dL' }],
    });
    request.flush({ id: 'rule-1', estado: 'BORRADOR' });
    expect(await result).toBe('rule-1');
  });

  it('posts to the validate endpoints', async () => {
    const reference = repository.validateReference('r1');
    http
      .expectOne('/api/v1/knowledge/references/r1/validate')
      .flush({ id: 'r1', estado: 'VALIDADA' });
    await reference;

    const rule = repository.validateRule('x1');
    http.expectOne('/api/v1/knowledge/rules/x1/validate').flush({ id: 'x1', estado: 'VALIDADA' });
    await rule;
  });

  it('maps a conflict on validation to a conflict error', async () => {
    const result = repository.validateReference('r1');
    http
      .expectOne('/api/v1/knowledge/references/r1/validate')
      .flush(
        { detail: 'overlaps', correlation_id: 'c-9' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(result).rejects.toMatchObject({ kind: 'conflict', correlationId: 'c-9' });
  });

  it('lists the draft rules with the estado filter', async () => {
    const result = repository.listRuleDrafts();
    const request = http.expectOne(
      (r) => r.url === '/api/v1/knowledge/rules' && r.params.get('estado') === 'BORRADOR',
    );
    request.flush({
      items: [{ id: 'r1', codigo: 'HB-BAJA', version: 2, estado: 'BORRADOR', nombre: 'Hemoglobina baja', criterios: [] }],
    });

    expect(await result).toEqual([{ id: 'r1', code: 'HB-BAJA', version: 2, name: 'Hemoglobina baja' }]);
  });

  it('lists the draft ranges of one analyte (the API needs the analyte for drafts)', async () => {
    const result = repository.listReferenceDrafts('a1');
    const request = http.expectOne(
      (r) =>
        r.url === '/api/v1/knowledge/references' &&
        r.params.get('estado') === 'BORRADOR' &&
        r.params.get('analito_id') === 'a1',
    );
    request.flush({
      items: [{ id: 'f1', analito_id: 'a1', version: 1, unidad: 'g/dL', minimo: 12, maximo: 16, estado: 'BORRADOR', fecha_inicio: '2026-01-01' }],
    });

    expect(await result).toEqual([{ id: 'f1', analyteId: 'a1', version: 1, unit: 'g/dL', min: 12, max: 16 }]);
  });
});
