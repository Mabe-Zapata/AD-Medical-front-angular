import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { WorkHoursRepository } from '../domain/ports/work-hours.repository';
import { HttpWorkHoursRepository } from './http-work-hours.repository';

const BASE = '/api/v1';

describe('HttpWorkHoursRepository', () => {
  let http: HttpTestingController;
  let repository: WorkHoursRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: BASE, defaultSourceId: null } },
        { provide: WorkHoursRepository, useClass: HttpWorkHoursRepository },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(WorkHoursRepository);
  });

  afterEach(() => http.verify());

  it('reads the doctor hours with this week and next week apart', async () => {
    const pending = repository.getMyHours();
    http.expectOne(`${BASE}/me/horario-trabajo`).flush({
      vigente_desde: '2026-11-30',
      actual: [{ dia_semana: 0, inicio: '08:00', fin: '10:00' }],
      proximo: [{ dia_semana: 0, inicio: '14:00', fin: '16:00' }],
    });

    const hours = await pending;

    expect(hours.effectiveFrom).toBe('2026-11-30');
    expect(hours.current).toEqual([{ dayOfWeek: 0, start: '08:00', end: '10:00' }]);
    expect(hours.next).toEqual([{ dayOfWeek: 0, start: '14:00', end: '16:00' }]);
  });

  it('saves the weekly schedule in the API shape', async () => {
    const pending = repository.saveMyHours([{ dayOfWeek: 2, start: '12:00', end: '13:00' }]);
    const request = http.expectOne({ method: 'PUT', url: `${BASE}/me/horario-trabajo` });

    expect(request.request.body).toEqual({ bloques: [{ dia_semana: 2, inicio: '12:00', fin: '13:00' }] });
    request.flush({ vigente_desde: '2026-11-30', actual: [], proximo: [] });
    await pending;
  });

  it('asks for the proposal of a week with the doctor and the Monday', async () => {
    const pending = repository.proposeWeek('doc-1', '2026-11-30');
    const request = http.expectOne(
      (r) => r.url === `${BASE}/admin/horarios/propuesta` && r.params.get('semana') === '2026-11-30',
    );

    expect(request.request.params.get('medico_id')).toBe('doc-1');
    request.flush({
      items: [{ inicio_utc: '2026-11-30T13:00:00+00:00', fin_utc: '2026-11-30T14:00:00+00:00', franja: 'MANANA' }],
      total: 1,
    });

    expect(await pending).toEqual([
      { startUtc: '2026-11-30T13:00:00+00:00', endUtc: '2026-11-30T14:00:00+00:00', window: 'MANANA' },
    ]);
  });

  it('generates a week and reports created and existing slots', async () => {
    const pending = repository.generateWeek('doc-1', 'off-1', '2026-11-30');
    const request = http.expectOne({ method: 'POST', url: `${BASE}/admin/horarios/generar` });

    expect(request.request.body).toEqual({
      medico_id: 'doc-1',
      consultorio_id: 'off-1',
      semana: '2026-11-30',
    });
    request.flush({ creados: 12, existentes: 3 });

    expect(await pending).toEqual({ created: 12, existing: 3 });
  });
});
