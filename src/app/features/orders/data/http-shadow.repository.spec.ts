import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { HttpShadowRepository } from './http-shadow.repository';

const ID = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';
const SNAPSHOT = '8d3c7a11-92b4-4d0b-8e56-0f5d9a3b6c22';

describe('HttpShadowRepository', () => {
  let repository: HttpShadowRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: '/api/v1', defaultSourceId: null } },
        HttpShadowRepository,
      ],
    });
    repository = TestBed.inject(HttpShadowRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps the live read: three findings with their cut-offs, plus the microcytosis signal when present', async () => {
    const result = repository.getReport(ID);
    http.expectOne(`/api/v1/lab/orders/${ID}/sombra`).flush({
      modo: 'SOMBRA',
      modifica_decision: false,
      anemia: { categoria: 'ANEMIA_LEVE', corte_g_l: 120, motivo: null },
      hierro: { categoria: 'NO_EVALUABLE', corte_ug_l: null, motivo: 'falta ferritina', fuente: 'WHO 2020' },
      diabetes: { categoria: 'SIN_EVIDENCIA_DIABETES', motivo: null },
      microcitosis: {
        categoria: 'SENAL_MICROCITOSIS',
        limite_inferior_fl: 80,
        motivo: null,
        aviso: 'Puede deberse a talasemia.',
        fuente: 'BSH 2022',
      },
    });

    const { findings } = await result;
    expect(findings.map((f) => f.key)).toEqual(['ANEMIA', 'HIERRO', 'DIABETES', 'MICROCITOSIS']);
    expect(findings[0].cutoff).toEqual({ value: 120, unit: 'g/L' });
    expect(findings[1].cutoff).toBeNull();
    expect(findings[1].reason).toBe('falta ferritina');
    expect(findings[3].notice).toBe('Puede deberse a talasemia.');
    expect(findings[3].cutoff).toEqual({ value: 80, unit: 'fL' });
  });

  it('leaves the microcytosis signal out when the backend sends none', async () => {
    const result = repository.getReport(ID);
    http.expectOne(`/api/v1/lab/orders/${ID}/sombra`).flush({
      modo: 'SOMBRA',
      modifica_decision: false,
      anemia: { categoria: 'SIN_ANEMIA', corte_g_l: 120, motivo: null },
      hierro: { categoria: 'SIN_DEFICIENCIA', corte_ug_l: 15, motivo: null, fuente: null },
      diabetes: { categoria: 'PREDIABETES', motivo: null },
      microcitosis: null,
    });
    expect((await result).findings.map((f) => f.key)).toEqual(['ANEMIA', 'HIERRO', 'DIABETES']);
  });

  it('posts a snapshot with no body and maps its items and evidence', async () => {
    const result = repository.recordSnapshot(ID);
    const request = http.expectOne(`/api/v1/lab/orders/${ID}/sombra/snapshots`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({
      id: SNAPSHOT,
      version_regla: 'sombra-hallazgos-2',
      creado_en: '2026-11-14T15:00:00+00:00',
      items: [
        {
          hallazgo: 'ANEMIA',
          categoria: 'ANEMIA_LEVE',
          corte_valor: 120,
          corte_unidad: 'g/L',
          fuente: 'WHO 2024',
          motivo: null,
          evidencia: [{ rol: 'hemoglobina', resultado_id: 'r1', valor: 11.2, unidad: 'g/dL' }],
        },
      ],
    });

    const snapshot = await result;
    expect(snapshot.id).toBe(SNAPSHOT);
    expect(snapshot.items[0].finding).toBe('ANEMIA');
    expect(snapshot.items[0].cutoff).toEqual({ value: 120, unit: 'g/L' });
    expect(snapshot.items[0].evidence).toEqual([
      { role: 'hemoglobina', resultId: 'r1', value: 11.2, unit: 'g/dL' },
    ]);
  });

  it('posts an edit to the finding of that snapshot and returns the stored category', async () => {
    const result = repository.editFinding(ID, SNAPSHOT, 'ANEMIA', {
      action: 'MODIFICAR',
      newCategory: 'ANEMIA_GRAVE',
      reason: 'Clínica compatible.',
    });
    const request = http.expectOne(
      `/api/v1/lab/orders/${ID}/sombra/snapshots/${SNAPSHOT}/hallazgos/ANEMIA/ediciones`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      accion: 'MODIFICAR',
      categoria_nueva: 'ANEMIA_GRAVE',
      motivo: 'Clínica compatible.',
    });
    request.flush({ id: 'e1', categoria_guardada: 'ANEMIA_GRAVE' });
    expect(await result).toBe('ANEMIA_GRAVE');
  });

  it('never sends a category with a confirmation or a discard', async () => {
    const result = repository.editFinding(ID, SNAPSHOT, 'HIERRO', {
      action: 'CONFIRMAR',
      newCategory: 'SIN_DEFICIENCIA',
      reason: 'Ok.',
    });
    const request = http.expectOne(
      `/api/v1/lab/orders/${ID}/sombra/snapshots/${SNAPSHOT}/hallazgos/HIERRO/ediciones`,
    );
    expect(request.request.body.categoria_nueva).toBeNull();
    request.flush({ id: 'e1', categoria_guardada: 'X' });
    await result;
  });

  it('lists the history of a finding and maps it', async () => {
    const result = repository.listEdits(ID, SNAPSHOT, 'DIABETES');
    http
      .expectOne(`/api/v1/lab/orders/${ID}/sombra/snapshots/${SNAPSHOT}/hallazgos/DIABETES/ediciones`)
      .flush({
        items: [
          {
            id: 'e1',
            accion: 'DESCARTAR',
            categoria_anterior: 'PREDIABETES',
            categoria_nueva: 'DESCARTADO',
            motivo: 'Dato de laboratorio dudoso.',
            medico_user_id: 'u1',
            creado_en: '2026-11-14T15:05:00+00:00',
          },
        ],
      });

    expect(await result).toEqual([
      {
        id: 'e1',
        action: 'DESCARTAR',
        previousCategory: 'PREDIABETES',
        newCategory: 'DESCARTADO',
        reason: 'Dato de laboratorio dudoso.',
        createdAt: '2026-11-14T15:05:00+00:00',
      },
    ]);
  });

  it('turns a 403 into a forbidden error', async () => {
    const result = repository.getReport(ID);
    http
      .expectOne(`/api/v1/lab/orders/${ID}/sombra`)
      .flush({ detail: 'x', correlation_id: 'c-9' }, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ kind: 'forbidden', correlationId: 'c-9' });
  });
});
