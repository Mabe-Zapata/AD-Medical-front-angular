import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { HttpAgendaRepository } from './http-agenda.repository';

describe('HttpAgendaRepository', () => {
  let repository: HttpAgendaRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: '/api/v1', defaultSourceId: null } },
        HttpAgendaRepository,
      ],
    });
    repository = TestBed.inject(HttpAgendaRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('queries /appointments and maps response with patient details', async () => {
    const promise = repository.listAppointments({ status: 'CONFIRMADA', limit: 10, offset: 0 });

    const req = http.expectOne((r) =>
      r.url === '/api/v1/appointments' &&
      r.params.get('estado') === 'CONFIRMADA' &&
      r.params.get('limit') === '10' &&
      r.params.get('offset') === '0',
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      items: [
        {
          id: 'apt-1',
          estado: 'CONFIRMADA',
          inicio: '2026-11-02T13:30:00Z',
          fin: '2026-11-02T14:00:00Z',
          paciente: { id: 'p-1', nombre: 'Carlos Ruiz' },
        },
      ],
    });

    const items = await promise;
    expect(items).toEqual([
      {
        id: 'apt-1',
        status: 'CONFIRMADA',
        startUtc: '2026-11-02T13:30:00Z',
        endUtc: '2026-11-02T14:00:00Z',
        patient: { id: 'p-1', name: 'Carlos Ruiz' },
        doctor: null,
        hasApproval: false,
      },
    ]);
  });

  it('does not break when paciente is omitted from the response', async () => {
    const promise = repository.listAppointments();

    const req = http.expectOne((r) => r.url === '/api/v1/appointments');
    expect(req.request.params.has('estado')).toBe(false);

    req.flush({
      items: [
        {
          id: 'apt-2',
          estado: 'PENDIENTE_PAGO',
          inicio: '2026-11-02T14:30:00Z',
          fin: '2026-11-02T15:00:00Z',
        },
      ],
    });

    const items = await promise;
    expect(items).toEqual([
      {
        id: 'apt-2',
        status: 'PENDIENTE_PAGO',
        startUtc: '2026-11-02T14:30:00Z',
        endUtc: '2026-11-02T15:00:00Z',
        patient: null,
        doctor: null,
        hasApproval: false,
      },
    ]);
  });

  it('maps doctor details and approval flag when present on response', async () => {
    const promise = repository.listAppointments({
      status: 'CONFIRMADA',
      doctorRegistration: 'TEST-MED-0001',
    });

    const req = http.expectOne(
      (r) =>
        r.url === '/api/v1/appointments' &&
        r.params.get('estado') === 'CONFIRMADA' &&
        r.params.get('medico_registro') === 'TEST-MED-0001',
    );

    req.flush({
      items: [
        {
          id: 'apt-3',
          estado: 'CONFIRMADA',
          inicio: '2026-11-02T16:00:00Z',
          fin: '2026-11-02T16:30:00Z',
          paciente: { id: 'p-3', nombre: 'Ana Torres' },
          medico: {
            id: 'm-1',
            nombre: 'Dr. Roberto Mendoza',
            registro_profesional: 'TEST-MED-0001',
            telefono: '0991234567',
          },
          tiene_aprobacion: true,
        },
      ],
    });

    const items = await promise;
    expect(items).toEqual([
      {
        id: 'apt-3',
        status: 'CONFIRMADA',
        startUtc: '2026-11-02T16:00:00Z',
        endUtc: '2026-11-02T16:30:00Z',
        patient: { id: 'p-3', name: 'Ana Torres' },
        doctor: {
          id: 'm-1',
          name: 'Dr. Roberto Mendoza',
          professionalRegistration: 'TEST-MED-0001',
          phone: '0991234567',
        },
        hasApproval: true,
      },
    ]);
  });

  it('translates HTTP 403 or 401 errors using toAppError', async () => {
    const promise = repository.listAppointments();

    const req = http.expectOne((r) => r.url === '/api/v1/appointments');
    req.flush(
      { type: 'about:blank', title: 'Forbidden', status: 403, detail: 'Not allowed', correlation_id: 'corr-1' },
      { status: 403, statusText: 'Forbidden' },
    );

    await expect(promise).rejects.toMatchObject({
      kind: 'forbidden',
      correlationId: 'corr-1',
    });
  });

  it('posts cancel request with motivo_codigo and motivo_texto', async () => {
    const promise = repository.cancelAppointment({
      appointmentId: 'apt-99',
      code: 'IMPREVISTO_MEDICO',
      reason: 'Cirugia imprevista de emergencia',
    });

    const req = http.expectOne('/api/v1/appointments/apt-99/cancel');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      motivo_codigo: 'IMPREVISTO_MEDICO',
      motivo_texto: 'Cirugia imprevista de emergencia',
    });

    req.flush({ id: 'apt-99', estado: 'CANCELADA' });
    await expect(promise).resolves.toBeUndefined();
  });

  it('maps 409 conflict when cancellation requires approval', async () => {
    const promise = repository.cancelAppointment({
      appointmentId: 'apt-99',
      code: 'OTRO_MEDICO',
      reason: 'Cancelacion fuera de plazo',
    });

    const req = http.expectOne('/api/v1/appointments/apt-99/cancel');
    req.flush(
      {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'LIMITE_CANCELACION_MEDICO',
        correlation_id: 'corr-409',
      },
      { status: 409, statusText: 'Conflict' },
    );

    await expect(promise).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
    });
  });

  it('posts cancellation approval and maps response', async () => {
    const promise = repository.approveCancellation({
      appointmentId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'Autorizado por jefatura medica',
    });

    const req = http.expectOne(
      '/api/v1/appointments/550e8400-e29b-41d4-a716-446655440000/cancellation-approval',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      motivo: 'Autorizado por jefatura medica',
    });

    req.flush(
      {
        cita_id: '550e8400-e29b-41d4-a716-446655440000',
        aprobada: true,
      },
      { status: 201, statusText: 'Created' },
    );

    const result = await promise;
    expect(result).toEqual({
      appointmentId: '550e8400-e29b-41d4-a716-446655440000',
      approved: true,
    });
  });

  it('translates 409 error on approval when already approved', async () => {
    const promise = repository.approveCancellation({
      appointmentId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'Segunda solicitud de autorizacion',
    });

    const req = http.expectOne(
      '/api/v1/appointments/550e8400-e29b-41d4-a716-446655440000/cancellation-approval',
    );
    req.flush(
      {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Appointment already has an approval',
        correlation_id: 'corr-app-409',
      },
      { status: 409, statusText: 'Conflict' },
    );

    await expect(promise).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
      correlationId: 'corr-app-409',
    });
  });

  describe('openConsultation', () => {
    it('POSTs to /appointments/:id/consultation and maps the response', async () => {
      const promise = repository.openConsultation({ appointmentId: 'apt-confirmed' });

      const req = http.expectOne('/api/v1/appointments/apt-confirmed/consultation');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});

      req.flush({
        id: 'consult-uuid',
        cita_id: 'apt-confirmed',
        estado: 'ABIERTA',
        inicio_atencion: '2026-11-16T13:00:00Z',
        motivo_consulta: null,
      });

      const result = await promise;
      expect(result).toEqual({
        id: 'consult-uuid',
        appointmentId: 'apt-confirmed',
        estado: 'ABIERTA',
        inicioAtencion: '2026-11-16T13:00:00Z',
        motivoConsulta: null,
      });
    });

    it('translates 409 to AppError kind=conflict', async () => {
      const promise = repository.openConsultation({ appointmentId: 'apt-wrong-state' });

      const req = http.expectOne('/api/v1/appointments/apt-wrong-state/consultation');
      req.flush(
        { type: 'about:blank', title: 'Conflict', status: 409, detail: 'Not CONFIRMADA' },
        { status: 409, statusText: 'Conflict' },
      );

      await expect(promise).rejects.toMatchObject({ kind: 'conflict', status: 409 });
    });

    it('translates 403 to AppError kind=forbidden', async () => {
      const promise = repository.openConsultation({ appointmentId: 'apt-other-doctor' });

      const req = http.expectOne('/api/v1/appointments/apt-other-doctor/consultation');
      req.flush(
        { type: 'about:blank', title: 'Forbidden', status: 403, detail: 'Not in agenda' },
        { status: 403, statusText: 'Forbidden' },
      );

      await expect(promise).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
    });
  });
});
