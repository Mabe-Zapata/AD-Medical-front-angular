import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '../../../../core/domain/app-error';
import {
  AgendaAppointment,
  ApproveCancellationCommand,
  CancellationApprovalResult,
} from '../../domain/entities/appointment';
import { ApproveCancellation } from '../../domain/usecases/approve-cancellation';
import { ListAgenda } from '../../domain/usecases/list-agenda';
import { CancellationApprovalPage } from './cancellation-approval.page';

class FakeApproveCancellation {
  calls: ApproveCancellationCommand[] = [];
  errorToThrow: unknown = null;

  async execute(command: ApproveCancellationCommand): Promise<CancellationApprovalResult> {
    this.calls.push(command);
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
    return {
      appointmentId: command.appointmentId,
      approved: true,
    };
  }
}

class FakeListAgenda {
  items: AgendaAppointment[] = [];
  async execute(): Promise<readonly AgendaAppointment[]> {
    return this.items;
  }
}

describe('CancellationApprovalPage', () => {
  let fakeApproveCancellation: FakeApproveCancellation;
  let fakeListAgenda: FakeListAgenda;
  let fixture: ComponentFixture<CancellationApprovalPage>;
  let el: HTMLElement;

  const validUuid = '550e8400-e29b-41d4-a716-446655440000';
  const otherUuid = '660e8400-e29b-41d4-a716-446655440000';
  const sampleAppointment: AgendaAppointment = {
    id: validUuid,
    status: 'CONFIRMADA',
    startUtc: '2026-11-12T15:00:00Z',
    endUtc: '2026-11-12T15:30:00Z',
    patient: { id: 'p-1', name: 'Paciente Uno' },
    doctor: {
      id: 'd-1',
      name: 'Carlos Gómez',
      professionalRegistration: 'TEST-MED-0001',
      phone: '0991234567',
    },
    hasApproval: false,
  };
  const otherAppointment: AgendaAppointment = {
    id: otherUuid,
    status: 'CONFIRMADA',
    startUtc: '2026-11-12T16:00:00Z',
    endUtc: '2026-11-12T16:30:00Z',
    patient: { id: 'p-2', name: 'Paciente Dos' },
    doctor: {
      id: 'd-2',
      name: 'Ana Mendoza',
      professionalRegistration: 'TEST-MED-0002',
      phone: '0997654321',
    },
    hasApproval: false,
  };

  beforeEach(async () => {
    fakeApproveCancellation = new FakeApproveCancellation();
    fakeListAgenda = new FakeListAgenda();
    fakeListAgenda.items = [sampleAppointment, otherAppointment];

    await TestBed.configureTestingModule({
      imports: [CancellationApprovalPage],
      providers: [
        provideRouter([]),
        { provide: ApproveCancellation, useValue: fakeApproveCancellation },
        { provide: ListAgenda, useValue: fakeListAgenda },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CancellationApprovalPage);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders search filter input and combo box selector with loaded appointments', () => {
    const searchInput = el.querySelector<HTMLInputElement>('#doctor-search');
    const select = el.querySelector<HTMLSelectElement>('#appointment-select');
    expect(searchInput).not.toBeNull();
    expect(select).not.toBeNull();
    expect(el.querySelector('#approval-reason')).not.toBeNull();
    expect(el.querySelector('.callout')?.textContent).toContain('Flujo administrativo');
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain(
      'Registrar aprobación',
    );
    expect(select?.value).toBe(validUuid);
  });

  it('renders summary box for selected appointment with doctor registration and phone', () => {
    const summary = el.querySelector('.appointment-summary-box');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('Paciente Uno');
    expect(summary?.textContent).toContain('Carlos Gómez');
    expect(summary?.textContent).toContain('TEST-MED-0001');
    expect(summary?.textContent).toContain('0991234567');
  });

  it('filters appointments in combo box by doctor registration number', async () => {
    const searchInput = el.querySelector<HTMLInputElement>('#doctor-search')!;
    searchInput.value = 'TEST-MED-0002';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const select = el.querySelector<HTMLSelectElement>('#appointment-select')!;
    const options = [...select.querySelectorAll('option')].filter((o) => o.value !== '' && o.value !== '__manual__');
    expect(options).toHaveLength(1);
    expect(options[0].value).toBe(otherUuid);
    expect(options[0].textContent).toContain('TEST-MED-0002');
  });

  it('submits selected appointment with reason and shows success banner', async () => {
    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = 'Autorizado por sobrecupo justificado';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fakeApproveCancellation.calls).toEqual([
      {
        appointmentId: validUuid,
        reason: 'Autorizado por sobrecupo justificado',
      },
    ]);

    expect(el.querySelector('.banner--success')?.textContent).toContain(
      `Aprobación registrada con éxito para la cita ${validUuid}`,
    );
  });

  it('allows searching/submitting by doctor registration number in manual mode without UUID', async () => {
    const toggleBtn = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Ingresar UUID manualmente'),
    );
    toggleBtn?.click();
    fixture.detectChanges();

    const idInput = el.querySelector<HTMLInputElement>('#appointment-id')!;
    idInput.value = 'TEST-MED-0002';
    idInput.dispatchEvent(new Event('input'));

    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = 'Autorización buscando por número del médico';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fakeApproveCancellation.calls).toEqual([
      {
        appointmentId: otherUuid,
        reason: 'Autorización buscando por número del médico',
      },
    ]);
  });

  it('shows friendly Spanish error on 409 conflict', async () => {
    fakeApproveCancellation.errorToThrow = new AppError('conflict', 'Already approved', undefined, 409);

    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = 'Intento de segunda aprobación';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.banner--danger')?.textContent).toContain(
      'Esta cita ya cuenta con una aprobación registrada o ya no puede ser cancelada.',
    );
  });

  it('shows friendly Spanish error on 404 not found', async () => {
    fakeApproveCancellation.errorToThrow = new AppError('not_found', 'Appointment not found', undefined, 404);

    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = 'Aprobación para cita inexistente';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.banner--danger')?.textContent).toContain(
      'No encontramos ninguna cita con el identificador ingresado.',
    );
  });

  it('clears form inputs, search and messages when reset button is clicked', async () => {
    const searchInput = el.querySelector<HTMLInputElement>('#doctor-search')!;
    searchInput.value = 'TEST';
    searchInput.dispatchEvent(new Event('input'));

    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = 'Texto de prueba';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const resetBtn = el.querySelector<HTMLButtonElement>('.actions button[type="button"]')!;
    resetBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector<HTMLTextAreaElement>('#approval-reason')!.value).toBe('');
    expect(el.querySelector<HTMLInputElement>('#doctor-search')!.value).toBe('');
  });
});
