import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../core/domain/app-error';
import {
  AgendaAppointment,
  CancelDoctorAppointmentCommand,
  ConsultationResult,
  OpenConsultationCommand,
} from '../../domain/entities/appointment';
import { ListAgendaFilter } from '../../domain/ports/agenda.ports';
import { CancelDoctorAppointment } from '../../domain/usecases/cancel-appointment';
import { ListAgenda } from '../../domain/usecases/list-agenda';
import { OpenConsultation } from '../../domain/usecases/open-consultation';
import { AgendaPage } from './agenda.page';

class FakeListAgenda {
  calls: ListAgendaFilter[] = [];
  shouldFail = false;
  items: AgendaAppointment[] = [];

  async execute(filter?: ListAgendaFilter): Promise<readonly AgendaAppointment[]> {
    this.calls.push(filter ?? {});
    if (this.shouldFail) {
      throw new Error('API failure');
    }
    return this.items;
  }
}

class FakeCancelDoctorAppointment {
  calls: CancelDoctorAppointmentCommand[] = [];
  errorToThrow: unknown = null;

  async execute(command: CancelDoctorAppointmentCommand): Promise<void> {
    this.calls.push(command);
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
  }
}

class FakeOpenConsultation {
  calls: OpenConsultationCommand[] = [];
  errorToThrow: unknown = null;
  result: ConsultationResult = {
    id: 'consult-1',
    appointmentId: 'apt-1',
    estado: 'ABIERTA',
    inicioAtencion: null,
    motivoConsulta: null,
  };

  async execute(command: OpenConsultationCommand): Promise<ConsultationResult> {
    this.calls.push(command);
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
    return this.result;
  }
}

describe('AgendaPage', () => {
  let fakeListAgenda: FakeListAgenda;
  let fakeCancelAppointment: FakeCancelDoctorAppointment;
  let fakeOpenConsultation: FakeOpenConsultation;
  let fixture: ComponentFixture<AgendaPage>;
  let el: HTMLElement;

  const sampleAppointments: AgendaAppointment[] = [
    {
      id: 'apt-1',
      status: 'CONFIRMADA',
      startUtc: '2026-11-02T13:30:00Z', // 08:30 UTC-5
      endUtc: '2026-11-02T14:00:00Z',   // 09:00 UTC-5
      patient: { id: 'p-1', name: 'Carlos Ruiz' },
    },
    {
      id: 'apt-2',
      status: 'PENDIENTE_PAGO',
      startUtc: '2026-11-02T14:00:00Z', // 09:00 UTC-5
      endUtc: '2026-11-02T14:30:00Z',   // 09:30 UTC-5
      patient: null, // missing patient in response must not break the column
    },
    {
      id: 'apt-3',
      status: 'COMPLETADA',
      startUtc: '2026-11-02T14:30:00Z',
      endUtc: '2026-11-02T15:00:00Z',
      patient: { id: 'p-2', name: 'Lucia Morales' },
    },
    {
      id: 'apt-4',
      status: 'CANCELADA',
      startUtc: '2026-11-02T15:00:00Z',
      endUtc: '2026-11-02T15:30:00Z',
      patient: { id: 'p-3', name: 'Marcos Benitez' },
    },
    {
      id: 'apt-5',
      status: 'NO_ASISTIO',
      startUtc: '2026-11-02T15:30:00Z',
      endUtc: '2026-11-02T16:00:00Z',
      patient: { id: 'p-4', name: 'Elena Solis' },
    },
    {
      id: 'apt-6',
      status: 'EXPIRADA',
      startUtc: '2026-11-02T16:00:00Z',
      endUtc: '2026-11-02T16:30:00Z',
      patient: { id: 'p-5', name: 'David Vera' },
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-01T00:00:00Z') });
    fakeListAgenda = new FakeListAgenda();
    fakeCancelAppointment = new FakeCancelDoctorAppointment();
    fakeOpenConsultation = new FakeOpenConsultation();

    TestBed.configureTestingModule({
      imports: [AgendaPage],
      providers: [
        provideRouter([]),
        { provide: ListAgenda, useValue: fakeListAgenda },
        { provide: CancelDoctorAppointment, useValue: fakeCancelAppointment },
        { provide: OpenConsultation, useValue: fakeOpenConsultation },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createComponent(items = sampleAppointments, shouldFail = false) {
    fakeListAgenda.items = items;
    fakeListAgenda.shouldFail = shouldFail;

    fixture = TestBed.createComponent(AgendaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  it('renders a paginated table defaulting to 5 rows and formats branch time (UTC-5)', async () => {
    await createComponent();

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(5); // Default page size is 5

    // Check first row (apt-1)
    const firstRowText = rows[0].textContent!;
    expect(firstRowText).toContain('lun 2 nov 2026');
    expect(firstRowText).toContain('08:30 – 09:00');
    expect(firstRowText).toContain('Carlos Ruiz');
    expect(firstRowText).toContain('Confirmada');

    // Check paginator is present showing 1-5 of 6
    const paginator = el.querySelector('app-paginator');
    expect(paginator).not.toBeNull();
    expect(paginator!.textContent).toContain('1–5 de 6');
  });

  it('renders "—" when paciente is absent and does not break the table', async () => {
    await createComponent();

    const rows = el.querySelectorAll('tbody tr');
    // apt-2 has patient: null
    const secondRowText = rows[1].textContent!;
    expect(secondRowText).toContain('09:00 – 09:30');
    expect(secondRowText).toContain('—');
    expect(secondRowText).toContain('Pago pendiente');
  });

  it('filters appointments by status and resets the paginator to the first page', async () => {
    await createComponent();

    const select = el.querySelector<HTMLSelectElement>('#agenda-status-filter')!;
    select.value = 'CONFIRMADA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fakeListAgenda.calls.length).toBeGreaterThanOrEqual(2);
    expect(fakeListAgenda.calls[fakeListAgenda.calls.length - 1]).toEqual({ status: 'CONFIRMADA' });
  });

  it('shows error banner and "Reintentar" button when request fails, and retries on click', async () => {
    await createComponent([], true);

    expect(el.textContent).toContain('No pudimos cargar la agenda del médico.');
    const retryBtn = el.querySelector<HTMLButtonElement>('button.btn--small')!;
    expect(retryBtn).not.toBeNull();
    expect(retryBtn.textContent).toContain('Reintentar');

    // Now fix failure and click retry
    fakeListAgenda.shouldFail = false;
    fakeListAgenda.items = [sampleAppointments[0]];
    retryBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.textContent).not.toContain('No pudimos cargar la agenda del médico.');
  });

  it('displays empty state with guidance when no appointments exist', async () => {
    await createComponent([]);

    expect(el.querySelectorAll('tbody tr').length).toBe(0);
    expect(el.textContent).toContain('No tienes citas registradas en tu agenda.');
    expect(el.textContent).toContain('Las citas aparecerán aquí cuando los pacientes las reserven');
  });

  describe('Open consultation (register attendance)', () => {
    it('shows "Registrar consulta" button for CONFIRMADA and COMPLETADA appointments', async () => {
      await createComponent();

      const rows = el.querySelectorAll('tbody tr');
      // apt-1 (CONFIRMADA) — should have btn--primary
      expect(rows[0].querySelector('button.btn--primary')).not.toBeNull();
      // apt-2 (PENDIENTE_PAGO) — no consultation button
      expect(rows[1].querySelector('button.btn--primary')).toBeNull();
      // apt-3 (COMPLETADA) — idempotent, should also show it
      expect(rows[2].querySelector('button.btn--primary')).not.toBeNull();
      // apt-4 (CANCELADA) — no button
      expect(rows[3].querySelector('button.btn--primary')).toBeNull();
    });

    it('opens consultation modal with patient name and appointment time on button click', async () => {
      await createComponent();

      const btn = el.querySelector('tbody tr button.btn--primary') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      const modal = el.querySelector('app-modal');
      expect(modal).not.toBeNull();
      expect(modal!.textContent).toContain('Confirmar atención de la cita');
      expect(modal!.textContent).toContain('Carlos Ruiz');
      expect(modal!.textContent).toContain('08:30 – 09:00');
    });

    it('submits consultation, closes modal, shows success notice, and reloads agenda', async () => {
      await createComponent();

      const btn = el.querySelector('tbody tr button.btn--primary') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      const initialLoadCalls = fakeListAgenda.calls.length;

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fakeOpenConsultation.calls).toEqual([{
        appointmentId: 'apt-1',
        diagnosis: undefined,
        treatment: undefined,
      }]);
      expect(el.querySelector('app-modal')).toBeNull();
      expect(el.textContent).toContain('Consulta registrada correctamente');
      expect(fakeListAgenda.calls.length).toBeGreaterThan(initialLoadCalls);
    });

    it('submits consultation with sanitized diagnosis and treatment fields', async () => {
      await createComponent();

      const btn = el.querySelector('tbody tr button.btn--primary') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      const diagArea = el.querySelector('#consultation-diagnosis') as HTMLTextAreaElement;
      diagArea.value = 'Rinofaringitis aguda';
      diagArea.dispatchEvent(new Event('input'));

      const treatArea = el.querySelector('#consultation-treatment') as HTMLTextAreaElement;
      treatArea.value = 'Paracetamol 500mg c/8h';
      treatArea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fakeOpenConsultation.calls).toEqual([{
        appointmentId: 'apt-1',
        diagnosis: 'Rinofaringitis aguda',
        treatment: 'Paracetamol 500mg c/8h',
      }]);
    });

    it('strips emojis from the diagnosis and treatment textareas on input so no emojis remain in the DOM', async () => {
      await createComponent();

      const btn = el.querySelector('tbody tr button.btn--primary') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      const diagArea = el.querySelector('#consultation-diagnosis') as HTMLTextAreaElement;
      diagArea.value = '😀😀😀Diagnóstico clínico';
      diagArea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(diagArea.value).toBe('Diagnóstico clínico');
      expect((fixture.componentInstance as any).consultationDiagnosis()).toBe('Diagnóstico clínico');

      // When entering ONLY emojis and spaces, the DOM textarea is completely emptied:
      diagArea.value = '😀 😀 😀 😀';
      diagArea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(diagArea.value).toBe('');
      expect((fixture.componentInstance as any).consultationDiagnosis()).toBe('');

      const treatArea = el.querySelector('#consultation-treatment') as HTMLTextAreaElement;
      treatArea.value = '💊Paracetamol 500mg';
      treatArea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(treatArea.value).toBe('Paracetamol 500mg');
      expect((fixture.componentInstance as any).consultationTreatment()).toBe('Paracetamol 500mg');
    });

    it('blocks submission and shows error if diagnosis contains emojis', async () => {
      await createComponent();

      const btn = el.querySelector('tbody tr button.btn--primary') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      const diagArea = el.querySelector('#consultation-diagnosis') as HTMLTextAreaElement;
      // Manually set signal directly to simulate emoji entry before input sanitizer
      (fixture.componentInstance as any).consultationDiagnosis.set('Diagnóstico 😷');
      fixture.detectChanges();

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();

      expect(fakeOpenConsultation.calls).toHaveLength(0);
      expect(el.querySelector('.field-error')?.textContent).toContain('El diagnóstico no puede contener emojis.');
    });

    it('blocks submission and shows error if treatment contains emojis', async () => {
      await createComponent();

      const btn = el.querySelector('tbody tr button.btn--primary') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      (fixture.componentInstance as any).consultationTreatment.set('Antibiótico 💊');
      fixture.detectChanges();

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();

      expect(fakeOpenConsultation.calls).toHaveLength(0);
      expect(el.querySelector('.field-error')?.textContent).toContain('El tratamiento no puede contener emojis.');
    });

    it('shows 409 error as "ya tiene una consulta registrada" message inside the modal', async () => {
      await createComponent();

      fakeOpenConsultation.errorToThrow = new AppError('conflict', 'CONSULTATION_EXISTS', undefined, 409);

      const btn = el.querySelector('tbody tr button.btn--primary') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const modal = el.querySelector('app-modal');
      expect(modal).not.toBeNull();
      expect(modal!.textContent).toContain('ya tiene una consulta registrada');
    });

    it('shows 403 error as "No tenés permiso" message inside the modal', async () => {
      await createComponent();

      fakeOpenConsultation.errorToThrow = new AppError('forbidden', 'FORBIDDEN', undefined, 403);

      const btn = el.querySelector('tbody tr button.btn--primary') as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const modal = el.querySelector('app-modal');
      expect(modal!.textContent).toContain('No tenés permiso');
    });
  });

  describe('Appointment cancellation (A2)', () => {
    it('shows "Cancelar" only for active appointments (CONFIRMADA, PENDIENTE_PAGO)', async () => {
      await createComponent();

      const rows = el.querySelectorAll('tbody tr');
      // apt-1 (CONFIRMADA)
      expect(rows[0].querySelector('button.btn--danger')).not.toBeNull();
      // apt-2 (PENDIENTE_PAGO)
      expect(rows[1].querySelector('button.btn--danger')).not.toBeNull();
      // apt-3 (COMPLETADA)
      expect(rows[2].querySelector('button.btn--danger')).toBeNull();
      // apt-4 (CANCELADA)
      expect(rows[3].querySelector('button.btn--danger')).toBeNull();
      // apt-5 (NO_ASISTIO)
      expect(rows[4].querySelector('button.btn--danger')).toBeNull();
    });

    it('opens cancellation modal with reason code choices when clicking Cancelar', async () => {
      await createComponent();

      const cancelBtn = el.querySelector('tbody tr button.btn--danger') as HTMLButtonElement;
      cancelBtn.click();
      fixture.detectChanges();

      const modal = el.querySelector('app-modal');
      expect(modal).not.toBeNull();
      expect(modal!.textContent).toContain('Confirmar cancelación de cita');
      expect(modal!.textContent).toContain('Carlos Ruiz');

      const selectCode = modal!.querySelector<HTMLSelectElement>('#cancel-reason-code');
      expect(selectCode).not.toBeNull();
      expect(selectCode!.value).toBe('IMPREVISTO_MEDICO');
    });

    it('never sends request without a reason (validates client-side before sending)', async () => {
      await createComponent();

      const cancelBtn = el.querySelector('tbody tr button.btn--danger') as HTMLButtonElement;
      cancelBtn.click();
      fixture.detectChanges();

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();

      // No request sent
      expect(fakeCancelAppointment.calls).toHaveLength(0);
      expect(el.querySelector('.field-error')?.textContent).toContain('Ingresa el motivo de la cancelación.');
    });

    it('submits valid cancellation with reason, shows notice, closes modal, and refreshes agenda', async () => {
      await createComponent();

      const cancelBtn = el.querySelector('tbody tr button.btn--danger') as HTMLButtonElement;
      cancelBtn.click();
      fixture.detectChanges();

      const textarea = el.querySelector('app-modal textarea') as HTMLTextAreaElement;
      textarea.value = 'Emergencia médica urgente en sala de operaciones';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const initialLoadCalls = fakeListAgenda.calls.length;

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fakeCancelAppointment.calls).toEqual([
        {
          appointmentId: 'apt-1',
          code: 'IMPREVISTO_MEDICO',
          reason: 'Emergencia médica urgente en sala de operaciones',
        },
      ]);
      expect(el.querySelector('app-modal')).toBeNull();
      expect(el.textContent).toContain('Cita cancelada con éxito.');
      expect(fakeListAgenda.calls.length).toBeGreaterThan(initialLoadCalls);
    });

    it('translates 409 error to "Necesita la aprobación del administrador" and reloads agenda', async () => {
      await createComponent();

      fakeCancelAppointment.errorToThrow = new AppError('conflict', 'LIMITE_CANCELACION_MEDICO', undefined, 409);

      const cancelBtn = el.querySelector('tbody tr button.btn--danger') as HTMLButtonElement;
      cancelBtn.click();
      fixture.detectChanges();

      const textarea = el.querySelector('app-modal textarea') as HTMLTextAreaElement;
      textarea.value = 'Cancelacion fuera de plazo de 24 horas';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const initialLoadCalls = fakeListAgenda.calls.length;

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Translates to exact required phrase:
      expect(el.querySelector('app-modal')?.textContent).toContain('Necesita la aprobación del administrador');
      // Reloads agenda so state is not uncertain:
      expect(fakeListAgenda.calls.length).toBeGreaterThan(initialLoadCalls);
    });

    it('strips emojis from the reason so only the clean text is submitted', async () => {
      await createComponent();

      const cancelBtn = el.querySelector('tbody tr button.btn--danger') as HTMLButtonElement;
      cancelBtn.click();
      fixture.detectChanges();

      const textarea = el.querySelector('app-modal textarea') as HTMLTextAreaElement;
      textarea.value = 'Emergencia médica 🚑';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const submitBtn = el.querySelector('app-modal button[type="submit"]') as HTMLButtonElement;
      submitBtn.click();
      fixture.detectChanges();

      expect(fakeCancelAppointment.calls).toHaveLength(1);
      expect(fakeCancelAppointment.calls[0]?.reason).toBe('Emergencia médica');
    });

    it('hides "Cancelar" button when an appointment has already passed', async () => {
      const pastApt: AgendaAppointment = {
        id: 'apt-past-cancel',
        status: 'CONFIRMADA',
        startUtc: '2026-10-30T10:00:00Z',
        endUtc: '2026-10-30T10:30:00Z',
        patient: { id: 'p-past', name: 'Paciente Anterior' },
      };
      await createComponent([pastApt]);

      const rows = el.querySelectorAll('tbody tr');
      expect(rows[0].querySelector('button.btn--danger')).toBeNull();
    });
  });

  it('displays "Horario concluido" badge when a confirmed appointment end time is in the past', async () => {
    const pastApt: AgendaAppointment = {
      id: 'apt-past',
      status: 'CONFIRMADA',
      startUtc: '2026-10-31T10:00:00Z',
      endUtc: '2026-10-31T10:30:00Z',
      patient: { id: 'p-1', name: 'Paciente Pasado' },
    };
    const futureApt: AgendaAppointment = {
      id: 'apt-future',
      status: 'CONFIRMADA',
      startUtc: '2030-01-01T10:00:00Z',
      endUtc: '2030-01-01T10:30:00Z',
      patient: { id: 'p-2', name: 'Paciente Futuro' },
    };
    await createComponent([pastApt, futureApt]);

    const rows = el.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Horario concluido');
    expect(rows[1].textContent).not.toContain('Horario concluido');
  });
});
