import { describe, expect, it } from 'vitest';

import {
  AgendaAppointment,
  ApproveCancellationCommand,
  CancellationApprovalResult,
  CancelDoctorAppointmentCommand,
  ConsultationResult,
  isAppointmentElapsed,
  OpenConsultationCommand,
} from './entities/appointment';
import { AgendaRepository, ListAgendaFilter } from './ports/agenda.ports';
import { ApproveCancellation } from './usecases/approve-cancellation';
import { CancelDoctorAppointment } from './usecases/cancel-appointment';
import { ListAgenda } from './usecases/list-agenda';
import { OpenConsultation } from './usecases/open-consultation';

class FakeAgendaRepository extends AgendaRepository {
  lastFilter?: ListAgendaFilter;
  lastCancelCommand?: CancelDoctorAppointmentCommand;
  lastApproveCommand?: ApproveCancellationCommand;
  lastOpenConsultationCommand?: OpenConsultationCommand;
  items: readonly AgendaAppointment[] = [];

  async listAppointments(filter?: ListAgendaFilter): Promise<readonly AgendaAppointment[]> {
    this.lastFilter = filter;
    return this.items;
  }

  async cancelAppointment(command: CancelDoctorAppointmentCommand): Promise<void> {
    this.lastCancelCommand = command;
  }

  async approveCancellation(
    command: ApproveCancellationCommand,
  ): Promise<CancellationApprovalResult> {
    this.lastApproveCommand = command;
    return {
      appointmentId: command.appointmentId,
      approved: true,
    };
  }

  async openConsultation(command: OpenConsultationCommand): Promise<ConsultationResult> {
    this.lastOpenConsultationCommand = command;
    return {
      id: 'consult-1',
      appointmentId: command.appointmentId,
      estado: 'ABIERTA',
      inicioAtencion: null,
      motivoConsulta: null,
    };
  }
}

describe('ListAgenda usecase', () => {
  it('delegates listing to the repository with the provided filter', async () => {
    const repo = new FakeAgendaRepository();
    const fakeList: AgendaAppointment[] = [
      {
        id: 'apt-1',
        status: 'CONFIRMADA',
        startUtc: '2026-11-02T13:30:00Z',
        endUtc: '2026-11-02T14:00:00Z',
        patient: { id: 'p-1', name: 'Juan Perez' },
      },
    ];
    repo.items = fakeList;

    const usecase = new ListAgenda(repo);
    const result = await usecase.execute({ status: 'CONFIRMADA', limit: 50, offset: 0 });

    expect(result).toBe(fakeList);
    expect(repo.lastFilter).toEqual({ status: 'CONFIRMADA', limit: 50, offset: 0 });
  });

  it('allows null patient in agenda items without error', async () => {
    const repo = new FakeAgendaRepository();
    repo.items = [
      {
        id: 'apt-2',
        status: 'PENDIENTE_PAGO',
        startUtc: '2026-11-02T14:00:00Z',
        endUtc: '2026-11-02T14:30:00Z',
        patient: null,
      },
    ];

    const usecase = new ListAgenda(repo);
    const result = await usecase.execute();

    expect(result).toHaveLength(1);
    expect(result[0].patient).toBeNull();
  });
});

describe('CancelDoctorAppointment usecase', () => {
  it('validates reason and delegates cancellation to repository', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new CancelDoctorAppointment(repo);

    await usecase.execute({
      appointmentId: 'apt-1',
      code: 'IMPREVISTO_MEDICO',
      reason: '  Emergencia medica en quirofano  ',
    });

    expect(repo.lastCancelCommand).toEqual({
      appointmentId: 'apt-1',
      code: 'IMPREVISTO_MEDICO',
      reason: 'Emergencia medica en quirofano',
    });
  });

  it('rejects empty or whitespace reason without calling repository', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new CancelDoctorAppointment(repo);

    await expect(
      usecase.execute({
        appointmentId: 'apt-1',
        code: 'IMPREVISTO_MEDICO',
        reason: '   ',
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'El motivo de la cancelación es obligatorio.',
    });
    expect(repo.lastCancelCommand).toBeUndefined();
  });

  it('rejects reason exceeding 1500 characters', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new CancelDoctorAppointment(repo);

    const longReason = 'a'.repeat(1501);
    await expect(
      usecase.execute({
        appointmentId: 'apt-1',
        code: 'OTRO_MEDICO',
        reason: longReason,
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'El motivo de la cancelación no puede superar los 1500 caracteres.',
    });
    expect(repo.lastCancelCommand).toBeUndefined();
  });
});

describe('ApproveCancellation usecase', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  it('validates UUID and delegates approval to repository', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new ApproveCancellation(repo);

    const result = await usecase.execute({
      appointmentId: validUuid,
      reason: '  Autorización por fuerza mayor  ',
    });

    expect(result).toEqual({
      appointmentId: validUuid,
      approved: true,
    });
    expect(repo.lastApproveCommand).toEqual({
      appointmentId: validUuid,
      reason: 'Autorización por fuerza mayor',
    });
  });

  it('rejects invalid UUID format', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new ApproveCancellation(repo);

    await expect(
      usecase.execute({
        appointmentId: 'not-a-valid-uuid',
        reason: 'Autorización médica',
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'El identificador de la cita debe ser un UUID válido.',
    });
    expect(repo.lastApproveCommand).toBeUndefined();
  });

  it('rejects empty reason', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new ApproveCancellation(repo);

    await expect(
      usecase.execute({
        appointmentId: validUuid,
        reason: '   ',
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'El motivo de la aprobación es obligatorio.',
    });
    expect(repo.lastApproveCommand).toBeUndefined();
  });

  it('rejects reason exceeding 1500 characters', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new ApproveCancellation(repo);

    await expect(
      usecase.execute({
        appointmentId: validUuid,
        reason: 'a'.repeat(1501),
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'El motivo de la aprobación no puede superar los 1500 caracteres.',
    });
    expect(repo.lastApproveCommand).toBeUndefined();
  });
});

describe('OpenConsultation usecase', () => {
  it('delegates to repository and returns consultation result', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new OpenConsultation(repo);

    const result = await usecase.execute({
      appointmentId: 'apt-confirmed',
      diagnosis: 'Faringitis aguda sin complicaciones',
      treatment: 'Amoxicilina 500mg c/8h por 7 días',
    });

    expect(repo.lastOpenConsultationCommand).toEqual({
      appointmentId: 'apt-confirmed',
      diagnosis: 'Faringitis aguda sin complicaciones',
      treatment: 'Amoxicilina 500mg c/8h por 7 días',
    });
    expect(result).toMatchObject({
      appointmentId: 'apt-confirmed',
      estado: 'ABIERTA',
    });
  });

  it('rejects diagnosis with emojis', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new OpenConsultation(repo);

    await expect(
      usecase.execute({
        appointmentId: 'apt-1',
        diagnosis: 'Gripe común 🤒',
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'El diagnóstico no puede contener emojis.',
    });
    expect(repo.lastOpenConsultationCommand).toBeUndefined();
  });

  it('rejects diagnosis exceeding 1000 characters', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new OpenConsultation(repo);

    await expect(
      usecase.execute({
        appointmentId: 'apt-1',
        diagnosis: 'a'.repeat(1001),
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'El diagnóstico no puede superar los 1000 caracteres.',
    });
    expect(repo.lastOpenConsultationCommand).toBeUndefined();
  });

  it('rejects treatment with emojis', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new OpenConsultation(repo);

    await expect(
      usecase.execute({
        appointmentId: 'apt-1',
        treatment: 'Tomar jarabe 💊 cada 8 horas',
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'El tratamiento no puede contener emojis.',
    });
    expect(repo.lastOpenConsultationCommand).toBeUndefined();
  });

  it('rejects treatment exceeding 1000 characters', async () => {
    const repo = new FakeAgendaRepository();
    const usecase = new OpenConsultation(repo);

    await expect(
      usecase.execute({
        appointmentId: 'apt-1',
        treatment: 'a'.repeat(1001),
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'El tratamiento no puede superar los 1000 caracteres.',
    });
    expect(repo.lastOpenConsultationCommand).toBeUndefined();
  });

  it('propagates repository errors without wrapping them', async () => {
    const repo = new FakeAgendaRepository();
    const error = new Error('409 conflict');
    repo.openConsultation = async () => { throw error; };
    const usecase = new OpenConsultation(repo);

    await expect(usecase.execute({ appointmentId: 'apt-1' })).rejects.toBe(error);
  });
});

describe('isAppointmentElapsed policy', () => {
  const refTime = new Date('2026-11-16T12:00:00Z').getTime();

  it('returns true when a confirmed appointment ended before the reference time', () => {
    expect(
      isAppointmentElapsed(
        { status: 'CONFIRMADA', endUtc: '2026-11-16T11:30:00Z' },
        refTime,
      ),
    ).toBe(true);
  });

  it('returns false when a confirmed appointment is in the future', () => {
    expect(
      isAppointmentElapsed(
        { status: 'CONFIRMADA', endUtc: '2026-11-16T13:00:00Z' },
        refTime,
      ),
    ).toBe(false);
  });

  it('returns false for terminal states even if endUtc is in the past', () => {
    expect(
      isAppointmentElapsed(
        { status: 'COMPLETADA', endUtc: '2026-11-16T10:00:00Z' },
        refTime,
      ),
    ).toBe(false);
    expect(
      isAppointmentElapsed(
        { status: 'CANCELADA', endUtc: '2026-11-16T10:00:00Z' },
        refTime,
      ),
    ).toBe(false);
    expect(
      isAppointmentElapsed(
        { status: 'NO_ASISTIO', endUtc: '2026-11-16T10:00:00Z' },
        refTime,
      ),
    ).toBe(false);
    expect(
      isAppointmentElapsed(
        { status: 'EXPIRADA', endUtc: '2026-11-16T10:00:00Z' },
        refTime,
      ),
    ).toBe(false);
  });
});
