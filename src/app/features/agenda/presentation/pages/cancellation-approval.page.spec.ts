import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '../../../../core/domain/app-error';
import {
  ApproveCancellationCommand,
  CancellationApprovalResult,
  CancellationCandidate,
} from '../../domain/entities/appointment';
import { ApproveCancellation } from '../../domain/usecases/approve-cancellation';
import { ListCancellationCandidates } from '../../domain/usecases/list-cancellation-candidates';
import { ListCancellationCandidatesFilter } from '../../domain/ports/agenda.ports';
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

/** Mirrors the server: the registration filter is exact, and the page is capped by limit. */
class FakeListCancellationCandidates {
  items: CancellationCandidate[] = [];
  calls: ListCancellationCandidatesFilter[] = [];
  shouldFail = false;

  async execute(filter?: ListCancellationCandidatesFilter): Promise<readonly CancellationCandidate[]> {
    this.calls.push(filter ?? {});
    if (this.shouldFail) {
      throw new AppError('network', 'Network down', undefined, 0);
    }
    const registration = filter?.doctorRegistration;
    const matching = registration
      ? this.items.filter((item) => item.doctor.professionalRegistration === registration)
      : this.items;
    return matching.slice(0, filter?.limit ?? 50);
  }
}

describe('CancellationApprovalPage', () => {
  let fakeApproveCancellation: FakeApproveCancellation;
  let fakeList: FakeListCancellationCandidates;
  let fixture: ComponentFixture<CancellationApprovalPage>;
  let el: HTMLElement;

  const validUuid = '550e8400-e29b-41d4-a716-446655440000';
  const otherUuid = '660e8400-e29b-41d4-a716-446655440000';
  const sampleAppointment: CancellationCandidate = {
    id: validUuid,
    status: 'CONFIRMADA',
    startUtc: '2026-11-12T15:00:00Z',
    endUtc: '2026-11-12T15:30:00Z',
    doctor: {
      id: 'd-1',
      name: 'Carlos Gómez',
      professionalRegistration: 'TEST-MED-0001',
    },
    hasApproval: false,
  };
  const otherAppointment: CancellationCandidate = {
    id: otherUuid,
    status: 'CONFIRMADA',
    startUtc: '2026-11-12T16:00:00Z',
    endUtc: '2026-11-12T16:30:00Z',
    doctor: {
      id: 'd-2',
      name: 'Ana Mendoza',
      professionalRegistration: 'TEST-MED-0002',
    },
    hasApproval: false,
  };

  /** Zoneless: let awaited use case calls finish, then render their results. */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    fakeApproveCancellation = new FakeApproveCancellation();
    fakeList = new FakeListCancellationCandidates();
    fakeList.items = [sampleAppointment, otherAppointment];

    await TestBed.configureTestingModule({
      imports: [CancellationApprovalPage],
      providers: [
        provideRouter([]),
        { provide: ApproveCancellation, useValue: fakeApproveCancellation },
        { provide: ListCancellationCandidates, useValue: fakeList },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CancellationApprovalPage);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
  });

  it('renders search input and combo box selector with loaded appointments', () => {
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

  it('loads confirmed appointments with the page limit and no registration filter', () => {
    expect(fakeList.calls[0]).toEqual({ status: 'CONFIRMADA', doctorRegistration: null, limit: 100 });
  });

  it('summary box shows the doctor registration and never the patient or a phone', () => {
    const summary = el.querySelector('.appointment-summary-box');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('Carlos Gómez');
    expect(summary?.textContent).toContain('TEST-MED-0001');
    expect(summary?.textContent).not.toContain('Paciente');
    expect(summary?.textContent).not.toContain('Tel');
  });

  it('option labels name the doctor and never the patient', () => {
    const options = [...el.querySelectorAll<HTMLOptionElement>('#appointment-select option')];
    const labels = options.map((o) => o.textContent ?? '').join(' ');
    expect(labels).toContain('TEST-MED-0001');
    expect(labels).toContain('Carlos Gómez');
    expect(labels).not.toContain('Paciente');
  });

  it('searches the server by registration number when Buscar is pressed', async () => {
    const searchInput = el.querySelector<HTMLInputElement>('#doctor-search')!;
    searchInput.value = 'TEST-MED-0002';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const searchButton = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Buscar',
    )!;
    searchButton.click();
    await settle();

    expect(fakeList.calls.at(-1)).toEqual({
      status: 'CONFIRMADA',
      doctorRegistration: 'TEST-MED-0002',
      limit: 100,
    });
    const options = [...el.querySelectorAll<HTMLSelectElement>('#appointment-select option')].filter(
      (o) => o.value !== '' && o.value !== '__manual__',
    );
    expect(options).toHaveLength(1);
    expect(options[0].value).toBe(otherUuid);
    expect(options[0].textContent).toContain('TEST-MED-0002');
  });

  it('says so when the search matches no appointment', async () => {
    const searchInput = el.querySelector<HTMLInputElement>('#doctor-search')!;
    searchInput.value = 'TEST-MED-9999';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.trim() === 'Buscar')!
      .click();
    await settle();

    expect(el.textContent).toContain('No hay citas confirmadas para el registro "TEST-MED-9999"');
  });

  it('warns that the list is truncated when a full page comes back', async () => {
    fakeList.items = Array.from({ length: 100 }, (_, index) => ({
      ...sampleAppointment,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    const reload = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Actualizar',
    )!;
    reload.click();
    await settle();

    expect(el.textContent).toContain('Se muestran las primeras 100 citas');
  });

  it('offers a retry when the list fails to load, and recovers', async () => {
    fakeList.shouldFail = true;
    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.trim() === 'Actualizar')!
      .click();
    await settle();

    const retry = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Reintentar',
    );
    expect(retry).toBeDefined();

    fakeList.shouldFail = false;
    retry!.click();
    await settle();

    expect(el.querySelector('#appointment-select')).not.toBeNull();
    expect(el.textContent).not.toContain('Reintentar');
  });

  it('submits selected appointment with reason and shows success banner', async () => {
    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = 'Autorizado por sobrecupo justificado';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    await settle();

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

  it('accepts a doctor registration number in manual mode and resolves it to the appointment', async () => {
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
    await settle();

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
    await settle();

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
    await settle();

    expect(el.querySelector('.banner--danger')?.textContent).toContain(
      'No encontramos ninguna cita con el identificador ingresado.',
    );
  });

  it('clears the reason, the search and messages when reset is clicked', async () => {
    const searchInput = el.querySelector<HTMLInputElement>('#doctor-search')!;
    searchInput.value = 'TEST-MED-0002';
    searchInput.dispatchEvent(new Event('input'));

    const reasonInput = el.querySelector<HTMLTextAreaElement>('#approval-reason')!;
    reasonInput.value = 'Texto de prueba';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const resetBtn = el.querySelector<HTMLButtonElement>('.actions button[type="button"]')!;
    resetBtn.click();
    await settle();

    expect(el.querySelector<HTMLTextAreaElement>('#approval-reason')!.value).toBe('');
    expect(el.querySelector<HTMLInputElement>('#doctor-search')!.value).toBe('');
  });
});
