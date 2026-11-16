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
  const sampleAppointment: AgendaAppointment = {
    id: validUuid,
    status: 'CONFIRMADA',
    startUtc: '2026-11-12T15:00:00Z',
    endUtc: '2026-11-12T15:30:00Z',
    patient: { id: 'p-1', name: 'Paciente Uno' },
    doctor: { id: 'd-1', name: 'Carlos Gómez' },
    hasApproval: false,
  };

  beforeEach(async () => {
    fakeApproveCancellation = new FakeApproveCancellation();
    fakeListAgenda = new FakeListAgenda();
    fakeListAgenda.items = [sampleAppointment];

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

  it('renders combo box selector with loaded appointments', () => {
    const select = el.querySelector<HTMLSelectElement>('#appointment-select');
    expect(select).not.toBeNull();
    expect(el.querySelector('#approval-reason')).not.toBeNull();
    expect(el.querySelector('.callout')?.textContent).toContain('Flujo administrativo');
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain(
      'Registrar aprobación',
    );
    // The first appointment without approval should be selected automatically
    expect(select?.value).toBe(validUuid);
  });

  it('renders summary box for selected appointment', () => {
    const summary = el.querySelector('.appointment-summary-box');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('Paciente Uno');
    expect(summary?.textContent).toContain('Carlos Gómez');
  });

  it('validates client inputs: rejects empty reason', async () => {
    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = '';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fakeApproveCancellation.calls).toHaveLength(0);
    expect(el.querySelector('.field-error')?.textContent).toContain(
      'El motivo de la aprobación es obligatorio',
    );
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

  it('switches to manual mode and allows UUID input and validation', async () => {
    const toggleBtn = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Ingresar UUID manualmente'),
    );
    expect(toggleBtn).toBeDefined();
    toggleBtn?.click();
    fixture.detectChanges();

    const idInput = el.querySelector<HTMLInputElement>('#appointment-id');
    expect(idInput).not.toBeNull();

    idInput!.value = 'invalid-uuid-123';
    idInput!.dispatchEvent(new Event('input'));

    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = 'Motivo de prueba';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fakeApproveCancellation.calls).toHaveLength(0);
    expect(el.querySelector('.field-error')?.textContent).toContain('Ingresa un UUID válido');
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

  it('clears form inputs and messages when reset button is clicked', async () => {
    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = 'Texto de prueba';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const resetBtn = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Limpiar'),
    )!;
    resetBtn.click();
    fixture.detectChanges();

    expect(el.querySelector<HTMLTextAreaElement>('#approval-reason')!.value).toBe('');
  });
});
