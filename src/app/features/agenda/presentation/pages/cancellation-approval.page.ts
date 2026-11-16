import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AppError } from '../../../../core/domain/app-error';
import { isUuid } from '../../../../core/domain/dates';
import { formatBranchDate, formatBranchTimeRange } from '../../../../core/time/branch-time';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { describeError } from '../../../../shared/presentation/error-message';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { AgendaAppointment, CancellationApprovalResult } from '../../domain/entities/appointment';
import { ApproveCancellation } from '../../domain/usecases/approve-cancellation';
import { ListAgenda } from '../../domain/usecases/list-agenda';

@Component({
  selector: 'app-cancellation-approval-page',
  imports: [FormsModule, BannerComponent, PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .approval-form {
      display: grid;
      gap: 20px;
      max-width: 680px;
    }
    .field-group {
      display: grid;
      gap: 6px;
    }
    .input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .input-row select,
    .input-row input {
      flex: 1;
    }
    .char-count {
      text-align: right;
      font-size: 12px;
      color: var(--muted, #64748b);
    }
    .field-error {
      color: var(--danger, #dc2626);
      font-size: 13px;
      font-weight: 500;
    }
    .callout {
      padding: 14px 16px;
      border-radius: 12px;
      background: var(--blue-tint, #eef3fb);
      border: 1px solid var(--border, #dbe3f0);
      color: var(--blue-text, #1d4f91);
      font-size: 14px;
      line-height: 1.5;
    }
    .appointment-summary-box {
      padding: 12px 16px;
      border-radius: 10px;
      background: var(--surface-subtle, #f8fafc);
      border: 1px solid var(--border, #e2e8f0);
    }
    .mode-toggle {
      display: flex;
      justify-content: flex-end;
      margin-top: 2px;
    }
    .link-button {
      background: none;
      border: none;
      padding: 0;
      color: var(--primary, #ea580c);
      font-size: 12px;
      cursor: pointer;
      text-decoration: underline;
    }
    .link-button:hover {
      opacity: 0.85;
    }
    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  `,
  template: `
    <div class="stack">
      <app-page-header
        area="Citas médicas"
        title="Aprobación de cancelación"
        [crumbs]="crumbs"
      >
        <p lede class="muted">
          Autoriza de forma excepcional la cancelación de citas médicas fuera de cupo o plazo.
        </p>
      </app-page-header>

      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }

      @if (error(); as errText) {
        <app-banner tone="danger">{{ errText }}</app-banner>
      }

      <div class="card stack">
        <div class="callout">
          <strong>Flujo administrativo:</strong>
          Busca la cita por el número de registro médico, teléfono o nombre del profesional, o selecciona directamente de la lista.
          Una vez registrada la aprobación, el médico podrá cancelar la cita desde su agenda médica sin ser bloqueado.
        </div>

        <form class="approval-form" (ngSubmit)="onSubmit()">
          @if (mode() === 'select') {
            <div class="field-group">
              <label for="doctor-search">
                <strong>Buscar por número o nombre del médico:</strong>
              </label>
              <div class="input-row">
                <input
                  id="doctor-search"
                  name="doctorSearch"
                  class="input"
                  type="text"
                  placeholder="ej. TEST-MED-0001, 0991234567 o nombre del médico..."
                  [ngModel]="searchTerm()"
                  (ngModelChange)="onSearchTermChange($event)"
                  [disabled]="submitting() || loadingAppointments()"
                />
                @if (searchTerm()) {
                  <button
                    type="button"
                    class="btn btn--small"
                    (click)="clearSearch()"
                    title="Limpiar filtro de búsqueda"
                  >
                    Borrar
                  </button>
                }
              </div>
              @if (searchTerm().trim(); as term) {
                <p class="muted small">
                  Filtrando por médico / paciente: <strong>"{{ term }}"</strong> ({{ filteredAppointments().length }} cita(s) encontrada(s)).
                </p>
              }
            </div>

            <div class="field-group">
              <label for="appointment-select">
                <strong>Cita médica a autorizar</strong>
              </label>

              @if (loadingAppointments()) {
                <p class="muted small">Cargando citas activas...</p>
              } @else if (appointments().length === 0) {
                <p class="muted small">
                  No hay citas confirmadas pendientes de aprobación en el sistema.
                </p>
              } @else if (filteredAppointments().length === 0) {
                <p class="field-error">
                  No se encontraron citas activas para "{{ searchTerm() }}". Prueba con otro número o nombre.
                </p>
              }

              <div class="input-row">
                <select
                  id="appointment-select"
                  name="appointmentSelect"
                  class="input"
                  [ngModel]="selectedOption()"
                  (ngModelChange)="onSelectOption($event)"
                  [disabled]="submitting() || loadingAppointments()"
                >
                  <option value="">-- Selecciona una cita --</option>
                  @for (appt of filteredAppointments(); track appt.id) {
                    <option [value]="appt.id" [disabled]="appt.hasApproval" [selected]="selectedOption() === appt.id">
                      {{ formatAppointmentOption(appt) }}
                    </option>
                  }
                  <option value="__manual__">-- Ingresar identificador manualmente (UUID) --</option>
                </select>
                <button
                  type="button"
                  class="btn btn--small"
                  [disabled]="submitting() || loadingAppointments()"
                  (click)="loadAppointments()"
                  title="Recargar citas disponibles"
                >
                  Actualizar
                </button>
              </div>

              <div class="mode-toggle">
                <button
                  type="button"
                  class="link-button"
                  (click)="switchToManual()"
                  [disabled]="submitting()"
                >
                  ¿No encuentras la cita? Ingresar UUID manualmente
                </button>
              </div>

              @if (appointmentIdError(); as err) {
                <span class="field-error">{{ err }}</span>
              }
            </div>
          } @else {
            <div class="field-group">
              <label for="appointment-id">
                <strong>Identificador de la cita (UUID o Número de Médico)</strong>
              </label>
              <div class="input-row">
                <input
                  id="appointment-id"
                  class="input"
                  type="text"
                  placeholder="ej. TEST-MED-0001 o 550e8400-e29b-41d4-a716-446655440000"
                  [value]="appointmentId()"
                  (input)="onAppointmentIdInput($event)"
                  [disabled]="submitting()"
                />
                <button
                  type="button"
                  class="btn btn--small"
                  [disabled]="submitting()"
                  (click)="onPasteClipboard()"
                  title="Pegar identificador desde el portapapeles"
                >
                  Pegar
                </button>
              </div>

              <div class="mode-toggle">
                <button
                  type="button"
                  class="link-button"
                  (click)="switchToSelect()"
                  [disabled]="submitting()"
                >
                  &larr; Volver al selector de citas
                </button>
              </div>

              @if (appointmentIdError(); as err) {
                <span class="field-error">{{ err }}</span>
              }
            </div>
          }

          @if (selectedAppointment(); as appt) {
            <div class="appointment-summary-box stack">
              <div class="row spread">
                <div>
                  <strong>{{ dateOf(appt.startUtc) }} &bull; {{ timeRangeOf(appt.startUtc, appt.endUtc) }}</strong>
                  <p class="muted small">
                    Paciente: <strong>{{ appt.patient?.name ?? 'Paciente sin nombre' }}</strong>
                    @if (appt.doctor?.name) {
                      &bull; Médico: <strong>Dr(a). {{ appt.doctor?.name }}</strong>
                    }
                    @if (appt.doctor?.professionalRegistration) {
                      &bull; Nº Registro: <strong>{{ appt.doctor?.professionalRegistration }}</strong>
                    }
                    @if (appt.doctor?.phone) {
                      &bull; Tel: <strong>{{ appt.doctor?.phone }}</strong>
                    }
                  </p>
                </div>
                <div>
                  @if (appt.hasApproval) {
                    <span class="badge badge--warning">Ya cuenta con aprobación</span>
                  } @else {
                    <span class="badge badge--neutral">ID: {{ appt.id }}</span>
                  }
                </div>
              </div>
            </div>
          }

          <div class="field-group">
            <label for="approval-reason">
              <strong>Motivo de la aprobación</strong>
            </label>
            <textarea
              id="approval-reason"
              name="approvalReason"
              class="input"
              rows="4"
              maxlength="1500"
              placeholder="Detalla el motivo por el cual se autoriza esta cancelación..."
              [ngModel]="reason()"
              (ngModelChange)="onReasonChange($event)"
              [disabled]="submitting()"
            ></textarea>
            <div class="char-count">{{ reason().length }} / 1500 caracteres</div>
            @if (reasonError(); as err) {
              <span class="field-error">{{ err }}</span>
            }
          </div>

          <div class="actions">
            <button
              type="submit"
              class="btn btn--primary"
              [disabled]="submitting() || !appointmentId() || (selectedAppointment()?.hasApproval ?? false)"
            >
              {{ submitting() ? 'Registrando aprobación...' : 'Registrar aprobación' }}
            </button>
            <button
              type="button"
              class="btn"
              [disabled]="submitting()"
              (click)="onReset()"
            >
              Limpiar
            </button>
            <a routerLink="/inicio" class="btn btn--ghost">Volver al inicio</a>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CancellationApprovalPage implements OnInit {
  private readonly approveCancellation = inject(ApproveCancellation);
  private readonly listAgenda = inject(ListAgenda);
  private readonly route = inject(ActivatedRoute);

  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Aprobación de cancelación' },
  ];

  protected readonly appointments = signal<readonly AgendaAppointment[]>([]);
  protected readonly loadingAppointments = signal(false);
  protected readonly loadAppointmentsError = signal<string | null>(null);

  protected readonly searchTerm = signal<string>('');
  protected readonly mode = signal<'select' | 'manual'>('select');
  protected readonly selectedOption = signal<string>('');
  protected readonly appointmentId = signal(
    this.route.snapshot.queryParamMap.get('cita_id') ??
      this.route.snapshot.queryParamMap.get('id') ??
      '',
  );
  protected readonly reason = signal('');

  protected readonly submitting = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly appointmentIdError = signal<string | null>(null);
  protected readonly reasonError = signal<string | null>(null);

  protected readonly filteredAppointments = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const all = this.appointments();
    if (!term) {
      return all;
    }
    return all.filter((appt) => {
      const docReg = (appt.doctor?.professionalRegistration ?? '').toLowerCase();
      const docPhone = (appt.doctor?.phone ?? '').toLowerCase();
      const docName = (appt.doctor?.name ?? '').toLowerCase();
      const patientName = (appt.patient?.name ?? '').toLowerCase();
      const id = appt.id.toLowerCase();
      return (
        docReg.includes(term) ||
        docPhone.includes(term) ||
        docName.includes(term) ||
        patientName.includes(term) ||
        id.includes(term)
      );
    });
  });

  protected readonly selectedAppointment = computed(() => {
    const id = this.appointmentId().trim().toLowerCase();
    if (!id) {
      return null;
    }
    return this.appointments().find((a) => a.id.toLowerCase() === id) ?? null;
  });

  async ngOnInit(): Promise<void> {
    await this.loadAppointments();
  }

  async loadAppointments(): Promise<void> {
    this.loadingAppointments.set(true);
    this.loadAppointmentsError.set(null);
    try {
      const items = await this.listAgenda.execute({ limit: 100, status: 'CONFIRMADA' });
      this.appointments.set(items);

      const currentId = this.appointmentId().trim();
      if (currentId) {
        const found = items.find((a) => a.id.toLowerCase() === currentId.toLowerCase());
        if (found) {
          this.selectedOption.set(found.id);
          this.mode.set('select');
        } else {
          // If not UUID, maybe it's a doctor registration number
          const matchDoc = this.findAppointmentByDoctorNumber(currentId);
          if (matchDoc) {
            this.selectedOption.set(matchDoc.id);
            this.appointmentId.set(matchDoc.id);
            this.mode.set('select');
          } else {
            this.selectedOption.set('__manual__');
            this.mode.set('manual');
          }
        }
      } else if (items.length > 0) {
        const firstAvailable = items.find((a) => !a.hasApproval) ?? items[0];
        this.selectedOption.set(firstAvailable.id);
        this.appointmentId.set(firstAvailable.id);
      }
    } catch (err) {
      this.loadAppointmentsError.set(describeError(err).message);
      this.mode.set('manual');
    } finally {
      this.loadingAppointments.set(false);
    }
  }

  protected onSearchTermChange(term: string): void {
    this.searchTerm.set(term);
    const filtered = this.filteredAppointments();
    if (filtered.length > 0) {
      const current = this.appointmentId();
      const match = filtered.find((a) => a.id === current);
      if (match) {
        this.selectedOption.set(match.id);
      } else {
        const first = filtered.find((a) => !a.hasApproval) ?? filtered[0];
        this.selectedOption.set(first.id);
        this.appointmentId.set(first.id);
      }
    } else {
      this.selectedOption.set('');
      this.appointmentId.set('');
    }
  }

  protected clearSearch(): void {
    this.onSearchTermChange('');
  }

  protected formatAppointmentOption(appt: AgendaAppointment): string {
    const date = this.dateOf(appt.startUtc);
    const time = this.timeRangeOf(appt.startUtc, appt.endUtc);
    const patient = appt.patient?.name ?? 'Paciente sin nombre';
    const doctor = appt.doctor?.name ? ` | Dr. ${appt.doctor.name}` : '';
    const reg = appt.doctor?.professionalRegistration ? ` [Nº ${appt.doctor.professionalRegistration}]` : '';
    const statusNote = appt.hasApproval ? ' (Ya cuenta con aprobación)' : '';
    return `${date} ${time} - ${patient}${doctor}${reg}${statusNote}`;
  }

  protected dateOf(utc: string): string {
    return formatBranchDate(utc);
  }

  protected timeRangeOf(startUtc: string, endUtc: string): string {
    return formatBranchTimeRange(startUtc, endUtc);
  }

  protected onSelectOption(value: string): void {
    this.selectedOption.set(value);
    if (value === '__manual__') {
      this.mode.set('manual');
      this.appointmentId.set('');
    } else {
      this.mode.set('select');
      this.appointmentId.set(value);
    }
    if (this.appointmentIdError()) {
      this.appointmentIdError.set(null);
    }
  }

  protected onSelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.onSelectOption(value);
  }

  protected switchToManual(): void {
    this.mode.set('manual');
    this.selectedOption.set('__manual__');
    this.appointmentIdError.set(null);
  }

  protected switchToSelect(): void {
    this.mode.set('select');
    const items = this.filteredAppointments();
    const first = items.find((a) => !a.hasApproval) ?? items[0];
    if (first) {
      this.selectedOption.set(first.id);
      this.appointmentId.set(first.id);
    } else {
      this.selectedOption.set('');
      this.appointmentId.set('');
    }
    this.appointmentIdError.set(null);
  }

  protected onAppointmentIdInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.appointmentId.set(value);
    if (this.appointmentIdError()) {
      this.appointmentIdError.set(null);
    }
  }

  protected async onPasteClipboard(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          this.appointmentId.set(text.trim());
          this.appointmentIdError.set(null);
        }
      }
    } catch {
      // Clipboard access denied or unavailable in current context
    }
  }

  protected onReasonChange(value: string): void {
    this.reason.set(value);
    if (this.reasonError()) {
      this.reasonError.set(null);
    }
  }

  protected onReasonInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.onReasonChange(value);
  }

  protected onReset(): void {
    this.searchTerm.set('');
    const items = this.appointments();
    if (this.mode() === 'select' && items.length > 0) {
      const first = items.find((a) => !a.hasApproval) ?? items[0];
      this.selectedOption.set(first.id);
      this.appointmentId.set(first.id);
    } else {
      this.selectedOption.set('');
      this.appointmentId.set('');
    }
    this.reason.set('');
    this.appointmentIdError.set(null);
    this.reasonError.set(null);
    this.notice.set(null);
    this.error.set(null);
  }

  private findAppointmentByDoctorNumber(term: string): AgendaAppointment | null {
    const t = term.trim().toLowerCase();
    if (!t) return null;
    return (
      this.appointments().find((a) => {
        const reg = (a.doctor?.professionalRegistration ?? '').toLowerCase();
        const phone = (a.doctor?.phone ?? '').toLowerCase();
        return reg === t || phone === t;
      }) ?? null
    );
  }

  protected async onSubmit(): Promise<void> {
    this.notice.set(null);
    this.error.set(null);

    let id = this.appointmentId().trim();
    const motivo = this.reason().trim();

    // Check if input is a doctor number instead of UUID
    if (!isUuid(id)) {
      const match = this.findAppointmentByDoctorNumber(id);
      if (match) {
        id = match.id;
        this.appointmentId.set(id);
      }
    }

    let hasClientErrors = false;
    if (!id || !isUuid(id)) {
      this.appointmentIdError.set(
        'Ingresa un UUID válido o el número de registro del médico (ej. TEST-MED-0001).',
      );
      hasClientErrors = true;
    } else {
      this.appointmentIdError.set(null);
    }

    if (motivo.length < 1) {
      this.reasonError.set('El motivo de la aprobación es obligatorio.');
      hasClientErrors = true;
    } else if (motivo.length > 1500) {
      this.reasonError.set('El motivo no puede superar los 1500 caracteres.');
      hasClientErrors = true;
    } else {
      this.reasonError.set(null);
    }

    if (hasClientErrors) {
      return;
    }

    this.submitting.set(true);
    try {
      const result: CancellationApprovalResult = await this.approveCancellation.execute({
        appointmentId: id,
        reason: motivo,
      });

      this.notice.set(
        `Aprobación registrada con éxito para la cita ${result.appointmentId}. El médico ya puede proceder a cancelarla.`,
      );
      this.reason.set('');
      await this.loadAppointments();
    } catch (err) {
      if (err instanceof AppError && err.status === 409) {
        this.error.set(
          'Esta cita ya cuenta con una aprobación registrada o ya no puede ser cancelada.',
        );
      } else if (err instanceof AppError && err.status === 404) {
        this.error.set('No encontramos ninguna cita con el identificador ingresado.');
      } else if (err instanceof AppError && err.status === 403) {
        this.error.set('No tienes permiso para aprobar cancelaciones de citas.');
      } else {
        this.error.set(describeError(err).message);
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
