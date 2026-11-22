import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { ReportsRepository } from '../domain/ports/reports.repository';
import { HttpReportsRepository } from './http-reports.repository';

const BASE = '/api/v1';

describe('HttpReportsRepository', () => {
  let http: HttpTestingController;
  let repository: ReportsRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: BASE, defaultSourceId: null } },
        { provide: ReportsRepository, useClass: HttpReportsRepository },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(ReportsRepository);
  });

  afterEach(() => http.verify());

  it('asks the summary for the inclusive period and translates the fields', async () => {
    const pending = repository.getSummary('2026-03-01', '2026-03-31');
    const request = http.expectOne((r) => r.url === `${BASE}/admin/reportes/resumen`);
    expect(request.request.params.get('desde')).toBe('2026-03-01');
    expect(request.request.params.get('hasta')).toBe('2026-03-31');
    request.flush({
      desde: '2026-03-01',
      hasta: '2026-03-31',
      citas: [{ estado: 'CONFIRMADA', total: 4 }],
      ordenes_laboratorio: [{ estado: 'COMPLETADA', total: 2 }],
      pagos: [{ estado: 'CONFIRMADO', total: 3, monto: '120.50' }],
      tratamientos: [],
    });

    const summary = await pending;
    expect(summary.from).toBe('2026-03-01');
    expect(summary.appointments).toEqual([{ state: 'CONFIRMADA', total: 4 }]);
    expect(summary.labOrders).toEqual([{ state: 'COMPLETADA', total: 2 }]);
    expect(summary.payments).toEqual([{ state: 'CONFIRMADO', total: 3, amount: '120.50' }]);
    expect(summary.treatments).toEqual([]);
  });

  it('reads the monitoring snapshot and keeps each destination', async () => {
    const pending = repository.getMonitoring();
    http.expectOne(`${BASE}/admin/monitoreo/estado`).flush({
      revisado_en: '2026-11-20T12:00:00+00:00',
      base_principal: { estado: 'DISPONIBLE', latencia_ms: 3.2 },
      replicacion: [
        {
          codigo: 'SUPABASE',
          entregas: [{ estado: 'ENTREGADO', total: 74 }],
          pendiente_mas_antiguo: null,
          ultima_entrega: '2026-11-20T11:59:00',
        },
      ],
    });

    const status = await pending;
    expect(status.checkedAt).toBe('2026-11-20T12:00:00+00:00');
    expect(status.databaseLatencyMs).toBe(3.2);
    expect(status.destinations).toEqual([
      {
        code: 'SUPABASE',
        deliveries: [{ state: 'ENTREGADO', total: 74 }],
        oldestPendingAt: null,
        lastDeliveryAt: '2026-11-20T11:59:00',
      },
    ]);
  });
});
