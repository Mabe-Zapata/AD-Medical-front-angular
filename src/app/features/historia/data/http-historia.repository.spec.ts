import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { HistoriaRepository } from '../domain/ports/historia.repository';
import { HttpHistoriaRepository } from './http-historia.repository';

const PATIENT = '11111111-1111-4111-8111-111111111111';

describe('HttpHistoriaRepository', () => {
  let repository: HistoriaRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: HistoriaRepository, useClass: HttpHistoriaRepository },
      ],
    });
    repository = TestBed.inject(HistoriaRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the history with the date range as query parameters and maps it to English', async () => {
    const promise = repository.readHistory(PATIENT, { from: '2026-01-01', to: '2026-06-30' });
    const req = http.expectOne((r) => r.url === `/api/v1/patients/${PATIENT}/historia`);
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    expect(req.request.params.get('hasta')).toBe('2026-06-30');
    req.flush({
      paciente_id: PATIENT,
      alergias: [
        {
          id: 'a1', tipo: 'alergia', estado: 'ACTIVA', origen: 'DECLARADA_PACIENTE', verificada: false,
          verificada_en: null, registrada_en: '2026-06-01T10:00:00Z',
          sustancia_codigo: 'PENICILINA', sustancia: 'Penicilina', categoria: 'MEDICAMENTO',
          severidad: 'GRAVE', reaccion: 'Urticaria',
        },
      ],
      antecedentes: [], medicacion: [], problemas: [], vacunas: [], signos_vitales: [],
    });

    const history = await promise;
    expect(history.allergies[0]).toMatchObject({
      id: 'a1', state: 'ACTIVA', origin: 'PATIENT', verified: false,
      details: { kind: 'allergy', substanceCode: 'PENICILINA', severity: 'GRAVE', reaction: 'Urticaria' },
    });
  });

  it('omits the date parameters of an open range', async () => {
    const promise = repository.readHistory(PATIENT, { from: null, to: null });
    const req = http.expectOne((r) => r.url === `/api/v1/patients/${PATIENT}/historia`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ paciente_id: PATIENT, alergias: [], antecedentes: [], medicacion: [], problemas: [], vacunas: [], signos_vitales: [] });
    await promise;
  });

  it('creates an allergy with the catalog code, not free text', async () => {
    const promise = repository.createEntry(PATIENT, {
      kind: 'allergy', substanceCode: 'PENICILINA', severity: 'GRAVE', reaction: null,
    });
    const req = http.expectOne(`/api/v1/patients/${PATIENT}/historia/alergias`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ sustancia_codigo: 'PENICILINA', severidad: 'GRAVE', reaccion: null });
    req.flush({
      id: 'a2', tipo: 'alergia', estado: 'ACTIVA', origen: 'REGISTRADA_MEDICO', verificada: true,
      verificada_en: '2026-11-25T10:00:00Z', registrada_en: '2026-11-25T10:00:00Z',
      sustancia_codigo: 'PENICILINA', sustancia: 'Penicilina', categoria: 'MEDICAMENTO', severidad: 'GRAVE', reaccion: null,
    });
    expect((await promise).verified).toBe(true);
  });

  it('verifies a declared entry through its own path', async () => {
    const promise = repository.verifyEntry(PATIENT, 'allergy', 'a1');
    const req = http.expectOne(`/api/v1/patients/${PATIENT}/historia/alergias/a1/verificar`);
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'a1', tipo: 'alergia', estado: 'ACTIVA', origen: 'DECLARADA_PACIENTE', verificada: true,
      verificada_en: '2026-11-25T10:00:00Z', registrada_en: null,
      sustancia_codigo: 'PENICILINA', sustancia: 'Penicilina', categoria: 'MEDICAMENTO', severidad: 'GRAVE', reaccion: null,
    });
    expect((await promise).verified).toBe(true);
  });

  it('sends the state the caller read and the motivo, so a stale change can be refused', async () => {
    const promise = repository.changeState(PATIENT, 'allergy', 'a1', {
      expected: 'ACTIVA', target: 'RESUELTA', reason: 'Desensibilizada',
    });
    const req = http.expectOne(`/api/v1/patients/${PATIENT}/historia/alergias/a1/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ expected_estado: 'ACTIVA', estado: 'RESUELTA', motivo: 'Desensibilizada' });
    req.flush({
      id: 'a1', tipo: 'alergia', estado: 'RESUELTA', origen: 'REGISTRADA_MEDICO', verificada: true,
      verificada_en: null, registrada_en: null, sustancia_codigo: 'X', sustancia: 'X', categoria: 'OTRA', severidad: 'LEVE', reaccion: null,
    });
    expect((await promise).state).toBe('RESUELTA');
  });

  it('sends only the vital measures that were filled in', async () => {
    const promise = repository.recordVitals('cita-1', {
      weightKg: 72.5, heightCm: null, systolic: 120, diastolic: null,
      heartRate: null, temperatureC: null, oxygen: null,
    });
    const req = http.expectOne('/api/v1/citas/cita-1/signos-vitales');
    expect(req.request.body).toEqual({ peso_kg: 72.5, pa_sistolica: 120 });
    req.flush({ id: 'v1', cita_id: 'cita-1', corrige_a: null, motivo_correccion: null, registrada_en: null, peso_kg: 72.5, pa_sistolica: 120 });
    expect((await promise).weightKg).toBe(72.5);
  });

  it('sends a correction with its motivo and keeps the link to the original', async () => {
    const promise = repository.correctVitals('v1', {
      weightKg: 70, heightCm: null, systolic: null, diastolic: null, heartRate: null, temperatureC: null, oxygen: null,
    }, 'Bascula mal calibrada');
    const req = http.expectOne('/api/v1/signos-vitales/v1/correccion');
    expect(req.request.body).toEqual({ peso_kg: 70, motivo: 'Bascula mal calibrada' });
    req.flush({ id: 'v2', cita_id: 'cita-1', corrige_a: 'v1', motivo_correccion: 'Bascula mal calibrada', registrada_en: null, peso_kg: 70 });
    expect((await promise).correctsId).toBe('v1');
  });

  it('reads the event log with its filters and tells whether the actor is included', async () => {
    const promise = repository.readEvents(PATIENT, { entity: 'alergia', action: 'CREAR', limit: 5, offset: 10 });
    const req = http.expectOne((r) => r.url === `/api/v1/patients/${PATIENT}/historia/eventos`);
    expect(req.request.params.get('entidad')).toBe('alergia');
    expect(req.request.params.get('accion')).toBe('CREAR');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush({
      items: [{ id: 7, entidad: 'alergia', entidad_id: 'a1', accion: 'CREAR', motivo: null, antes: null,
        despues: { estado: 'ACTIVA' }, ocurrido_en: '2026-11-25T10:00:00Z', actor_usuario_id: 'u1' }],
      total: 1, limit: 5, offset: 10, incluye_actor: true,
    });
    const page = await promise;
    expect(page.includesActor).toBe(true);
    expect(page.items[0]).toMatchObject({ id: 7, actorId: 'u1', action: 'CREAR' });
  });

  it('maps a refusal with its business code so the screen can say what happened', async () => {
    const promise = repository.changeState(PATIENT, 'allergy', 'a1', {
      expected: 'ACTIVA', target: 'ERRONEA', reason: 'x',
    });
    http.expectOne(`/api/v1/patients/${PATIENT}/historia/alergias/a1/estado`).flush(
      { detail: 'The entry changed since it was read', code: 'CONFLICTO' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(promise).rejects.toMatchObject({ kind: 'conflict', status: 409 });
  });

  it('searches a catalog with its query and limit', async () => {
    const promise = repository.searchCatalog('sustancias-alergia', 'peni', 20);
    const req = http.expectOne((r) => r.url === '/api/v1/catalogos/sustancias-alergia');
    expect(req.request.params.get('q')).toBe('peni');
    req.flush({ items: [{ codigo: 'PENICILINA', nombre: 'Penicilina', categoria: 'MEDICAMENTO' }] });
    expect(await promise).toEqual([{ code: 'PENICILINA', name: 'Penicilina', category: 'MEDICAMENTO' }]);
  });
});
