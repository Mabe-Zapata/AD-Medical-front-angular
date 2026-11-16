import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { formatBranchDate, formatBranchTimeRange } from '../../../../core/time/branch-time';
import {
  hasEmoji,
  isValidClinicalText,
  sanitizeClinicalText,
  sanitizeFreeText,
} from '../../../../core/domain/text';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { describeError } from '../../../../shared/presentation/error-message';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { ModalComponent } from '../../../../shared/presentation/organisms/modal';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { PageState } from '../../../../shared/presentation/pagination';
import {
  AgendaAppointment,
  AppointmentStatus,
  canCancelAppointment,
  canOpenConsultation,
  DoctorCancellationCode,
  isAppointmentElapsed,
} from '../../domain/entities/appointment';
import { CancelDoctorAppointment } from '../../domain/usecases/cancel-appointment';
import { ListAgenda } from '../../domain/usecases/list-agenda';
import { OpenConsultation } from '../../domain/usecases/open-consultation';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from '../labels';

export type StatusFilterOption = AppointmentStatus | 'TODOS';

/** Max chars for the consultation notes field (informational only — backend has no note body). */
export const CONSULTATION_NOTES_MAX = 500;

@Component({
  selector: 'app-agenda-page',
  imports: [
    FormsModule,
    BannerComponent,
    ChipComponent,
    ModalComponent,
    PaginatorComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .table-wrap {
      overflow-x: auto;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .empty-state {
      padding: 16px 0;
      gap: 6px;
    }
    .field-error {
      color: var(--danger, #dc2626);
      font-size: 13px;
      font-weight: 500;
    }
    .status-cell {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .badge-elapsed {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #9a3412;
      background: #ffedd5;
      border: 1px solid #fed7aa;
      border-radius: 4px;
      padding: 2px 6px;
      line-height: 1.2;
      white-space: nowrap;
    }
    .char-hint {
      font-size: 12px;
      color: var(--muted, #6b7280);
      text-align: right;
    }
  `,
  template: `
    <div class="stack">
      <app-page-header area="Agenda médica" title="Agenda del médico" [crumbs]="crumbs">
        <p lede class="muted">Consulta las citas programadas de los pacientes en la sucursal.</p>
      </app-page-header>

      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }

      <section class="card stack">
        <div class="row spread">
          <div>
            <h2>Citas asignadas</h2>
            <p class="muted small">Horarios en hora de la sucursal (UTC-5). Paginación de 5 citas por defecto.</p>
          </div>
          <div class="filter-group">
            <label for="agenda-status-filter" class="muted small">Filtrar por estado:</label>
            <select
              id="agenda-status-filter"
              class="input input--small"
              [ngModel]="statusFilter()"
              (ngModelChange)="onFilterChange($event)"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="CONFIRMADA">Confirmada</option>
              <option value="PENDIENTE_PAGO">Pago pendiente</option>
              <option value="COMPLETADA">Completada</option>
              <option value="CANCELADA">Cancelada</option>
              <option value="NO_ASISTIO">No asistió</option>
              <option value="EXPIRADA">Expirada</option>
            </select>
          </div>
        </div>

        @if (listing() === 'loading') {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando agenda…</p>
        } @else if (listing() === 'failed') {
          <app-banner tone="danger">No pudimos cargar la agenda del médico.</app-banner>
          <div>
            <button class="btn btn--small" type="button" (click)="reload()">Reintentar</button>
          </div>
        } @else if (appointments().length === 0) {
          <div class="empty-state stack">
            <p class="empty">No tienes citas registradas en tu agenda.</p>
            <p class="muted small">
              @if (statusFilter() !== 'TODOS') {
                No hay citas con el estado seleccionado. Intenta cambiar el filtro a "Todos los estados".
              } @else {
                Las citas aparecerán aquí cuando los pacientes las reserven desde el portal o recepción.
              }
            </p>
          </div>
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Horario (UTC-5)</th>
                  <th>Paciente</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (appointment of pager.slice(appointments()); track appointment.id) {
                  <tr>
                    <td>{{ dateOf(appointment.startUtc) }}</td>
                    <td>{{ timeRangeOf(appointment.startUtc, appointment.endUtc) }}</td>
                    <td>{{ appointment.patient?.name ?? '—' }}</td>
                    <td>
                      <div class="status-cell">
                        <app-chip [tone]="statusTone(appointment.status)">
                          {{ statusLabel(appointment.status) }}
                        </app-chip>
                        @if (isElapsed(appointment)) {
                          <span
                            class="badge-elapsed"
                            title="El horario asignado ya concluyó y está pendiente de registro de consulta"
                          >
                            Horario concluido
                          </span>
                        }
                      </div>
                    </td>
                    <td>
                      <div class="row" style="gap: 8px;">
                        @if (canOpenConsultation(appointment)) {
                          <button
                            class="btn btn--small btn--primary"
                            type="button"
                            (click)="openConsultationModal(appointment)"
                          >
                            Registrar consulta
                          </button>
                        }
                        @if (canCancel(appointment)) {
                          <button
                            class="btn btn--small btn--danger"
                            type="button"
                            (click)="openCancelModal(appointment)"
                          >
                            Cancelar
                          </button>
                        }
                        @if (!canOpenConsultation(appointment) && !canCancel(appointment)) {
                          <span class="muted small">—</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [total]="appointments().length" [state]="pager" />
        }
      </section>

      <!-- Consultation modal -->
      @if (consultationTarget(); as target) {
        <app-modal
          tag="Registrar consulta"
          headline="Confirmar atención de la cita"
          [bullets]="consultationBullets"
          [centered]="true"
          (closed)="closeConsultationModal()"
        >
          @if (consultationError(); as err) {
            <app-banner tone="danger">{{ err }}</app-banner>
          }

          <form class="stack" (ngSubmit)="submitConsultation(target)" novalidate>
            <p class="muted">
              Vas a registrar la consulta de
              <strong>{{ target.patient?.name ?? 'Paciente' }}</strong> del
              <strong>{{ dateOf(target.startUtc) }}</strong> a las
              <strong>{{ timeRangeOf(target.startUtc, target.endUtc) }}</strong>.
            </p>

            <div class="field">
              <label for="consultation-diagnosis">Diagnóstico u observaciones clínicas</label>
              <textarea
                id="consultation-diagnosis"
                class="input"
                name="consultationDiagnosis"
                rows="3"
                maxlength="1000"
                placeholder="Indica el diagnóstico o hallazgos clínicos (máx. 1000 caracteres, sin emojis)..."
                [value]="consultationDiagnosis()"
                (input)="onDiagnosisInput($event)"
              ></textarea>
              <span class="char-hint">{{ consultationDiagnosis().length }} / 1000</span>
              @if (diagnosisValidationError(); as dErr) {
                <span class="field-error">{{ dErr }}</span>
              }
            </div>

            <div class="field">
              <label for="consultation-treatment">Plan de tratamiento</label>
              <textarea
                id="consultation-treatment"
                class="input"
                name="consultationTreatment"
                rows="3"
                maxlength="1000"
                placeholder="Indica el tratamiento, medicamentos o indicaciones (máx. 1000 caracteres, sin emojis)..."
                [value]="consultationTreatment()"
                (input)="onTreatmentInput($event)"
              ></textarea>
              <span class="char-hint">{{ consultationTreatment().length }} / 1000</span>
              @if (treatmentValidationError(); as tErr) {
                <span class="field-error">{{ tErr }}</span>
              }
            </div>

            <p class="muted small">
              Esta acción marcará la cita como <strong>atendida</strong>. Es irreversible desde el portal.
            </p>

            <div class="row" style="margin-top: 8px;">
              <button
                class="btn btn--primary"
                type="submit"
                [disabled]="submittingConsultation()"
              >
                @if (submittingConsultation()) {
                  <span class="spinner" aria-hidden="true"></span> Registrando…
                } @else {
                  Confirmar atención
                }
              </button>
              <button
                class="btn btn--ghost"
                type="button"
                (click)="closeConsultationModal()"
              >
                Volver
              </button>
            </div>
          </form>
        </app-modal>
      }

      <!-- Cancel modal -->
      @if (cancellingTarget(); as target) {
        <app-modal
          tag="Cancelar cita"
          headline="Confirmar cancelación de cita"
          [bullets]="cancelBullets"
          (closed)="closeCancelModal()"
        >
          @if (cancelError(); as err) {
            <app-banner tone="danger">
              {{ err }}
              @if (err.includes('aprobación del administrador')) {
                <div class="row small" style="margin-top: 8px; align-items: center; justify-content: space-between;">
                  <span>ID de cita: <code class="mono">{{ target.id }}</code></span>
                  <button type="button" class="btn btn--small" (click)="copyAppointmentId(target.id)">
                    {{ copiedId() ? '¡Copiado!' : 'Copiar ID' }}
                  </button>
                </div>
              }
            </app-banner>
          }

          <form class="stack" (ngSubmit)="submitCancel(target)" novalidate>
            <p class="muted">
              Vas a cancelar la cita de <strong>{{ target.patient?.name ?? 'Paciente' }}</strong> programada para el
              <strong>{{ dateOf(target.startUtc) }}</strong> a las
              <strong>{{ timeRangeOf(target.startUtc, target.endUtc) }}</strong>.
            </p>

            <div class="field">
              <label for="cancel-reason-code">Tipo de motivo</label>
              <select
                id="cancel-reason-code"
                class="input"
                name="cancelReasonCode"
                [value]="cancelReasonCode()"
                (change)="cancelReasonCode.set($any($event.target).value)"
              >
                <option value="IMPREVISTO_MEDICO">Imprevisto médico</option>
                <option value="OTRO_MEDICO">Otro motivo médico</option>
              </select>
            </div>

            <div class="field">
              <label for="cancel-reason-text">Motivo de la cancelación</label>
              <textarea
                id="cancel-reason-text"
                class="input"
                name="cancelReasonText"
                rows="4"
                maxlength="1500"
                placeholder="Indica el motivo detallado (obligatorio, de 1 a 1500 caracteres)..."
                [value]="cancelReasonText()"
                (input)="onReasonInput($event)"
              ></textarea>
              <span class="char-hint">{{ cancelReasonText().length }} / 1500</span>
              @if (cancelValidationError(); as vError) {
                <span class="field-error">{{ vError }}</span>
              }
            </div>

            <div class="row">
              <button
                class="btn btn--danger"
                type="submit"
                [disabled]="submittingCancel()"
              >
                @if (submittingCancel()) {
                  <span class="spinner" aria-hidden="true"></span> Cancelando…
                } @else {
                  Confirmar cancelación
                }
              </button>
              <button
                class="btn btn--ghost"
                type="button"
                (click)="closeCancelModal()"
              >
                Volver
              </button>
            </div>
          </form>
        </app-modal>
      }
    </div>
  `,
})
export class AgendaPage {
  private readonly listAgenda = inject(ListAgenda);
  private readonly cancelDoctorAppointment = inject(CancelDoctorAppointment);
  private readonly openConsultationUsecase = inject(OpenConsultation);

  protected readonly pager = new PageState();
  protected readonly listing = signal<'loading' | 'ready' | 'failed'>('loading');
  protected readonly appointments = signal<readonly AgendaAppointment[]>([]);
  protected readonly statusFilter = signal<StatusFilterOption>('TODOS');
  protected readonly notice = signal<string | null>(null);

  // Consultation modal state
  protected readonly consultationTarget = signal<AgendaAppointment | null>(null);
  protected readonly consultationDiagnosis = signal('');
  protected readonly consultationTreatment = signal('');
  protected readonly diagnosisValidationError = signal<string | null>(null);
  protected readonly treatmentValidationError = signal<string | null>(null);
  protected readonly consultationError = signal<string | null>(null);
  protected readonly submittingConsultation = signal(false);

  // Cancel modal state
  protected readonly cancellingTarget = signal<AgendaAppointment | null>(null);
  protected readonly cancelReasonCode = signal<DoctorCancellationCode>('IMPREVISTO_MEDICO');
  protected readonly cancelReasonText = signal('');
  protected readonly cancelValidationError = signal<string | null>(null);
  protected readonly cancelError = signal<string | null>(null);
  protected readonly submittingCancel = signal(false);
  protected readonly copiedId = signal(false);

  protected async copyAppointmentId(id: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
        this.copiedId.set(true);
        setTimeout(() => this.copiedId.set(false), 2000);
      }
    } catch {
      // Clipboard access blocked
    }
  }

  protected readonly consultationBullets = [
    'Registrar la consulta confirma que el médico atendió al paciente.',
    'Esta acción no puede deshacerse desde el portal.',
  ];

  protected readonly cancelBullets = [
    'Al cancelar la cita, se liberará el horario de atención.',
    'Si estás fuera de plazo o superaste el cupo mensual, requerirá aprobación del administrador.',
  ];

  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Agenda del médico' },
  ];

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.listing.set('loading');
    try {
      const filter = this.statusFilter();
      const items = await this.listAgenda.execute({
        status: filter === 'TODOS' ? undefined : filter,
      });
      this.appointments.set(items);
      this.listing.set('ready');
    } catch {
      this.listing.set('failed');
    }
  }

  protected reload(): void {
    void this.load();
  }

  protected onFilterChange(status: StatusFilterOption): void {
    this.statusFilter.set(status);
    this.pager.page.set(0);
    void this.load();
  }

  protected canOpenConsultation(appointment: AgendaAppointment): boolean {
    return canOpenConsultation(appointment);
  }

  protected canCancel(appointment: AgendaAppointment): boolean {
    return canCancelAppointment(appointment);
  }

  // ── Consultation modal ────────────────────────────────────────────────────

  protected onDiagnosisInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const raw = target?.value ?? '';
    let cleaned = sanitizeClinicalText(raw);
    if (raw.length > 0 && cleaned.trim().length === 0) {
      cleaned = '';
    }
    if (target && target.value !== cleaned) {
      target.value = cleaned;
    }
    this.consultationDiagnosis.set(cleaned);
    if (this.diagnosisValidationError()) {
      this.diagnosisValidationError.set(null);
    }
  }

  protected onDiagnosisChange(text: string): void {
    let cleaned = sanitizeClinicalText(text);
    if (text.length > 0 && cleaned.trim().length === 0) {
      cleaned = '';
    }
    this.consultationDiagnosis.set(cleaned);
    if (this.diagnosisValidationError()) {
      this.diagnosisValidationError.set(null);
    }
  }

  protected onTreatmentInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const raw = target?.value ?? '';
    let cleaned = sanitizeClinicalText(raw);
    if (raw.length > 0 && cleaned.trim().length === 0) {
      cleaned = '';
    }
    if (target && target.value !== cleaned) {
      target.value = cleaned;
    }
    this.consultationTreatment.set(cleaned);
    if (this.treatmentValidationError()) {
      this.treatmentValidationError.set(null);
    }
  }

  protected onTreatmentChange(text: string): void {
    let cleaned = sanitizeClinicalText(text);
    if (text.length > 0 && cleaned.trim().length === 0) {
      cleaned = '';
    }
    this.consultationTreatment.set(cleaned);
    if (this.treatmentValidationError()) {
      this.treatmentValidationError.set(null);
    }
  }

  protected openConsultationModal(appointment: AgendaAppointment): void {
    this.notice.set(null);
    this.consultationTarget.set(appointment);
    this.consultationDiagnosis.set('');
    this.consultationTreatment.set('');
    this.diagnosisValidationError.set(null);
    this.treatmentValidationError.set(null);
    this.consultationError.set(null);
  }

  protected closeConsultationModal(): void {
    this.consultationTarget.set(null);
    this.consultationDiagnosis.set('');
    this.consultationTreatment.set('');
    this.diagnosisValidationError.set(null);
    this.treatmentValidationError.set(null);
    this.consultationError.set(null);
  }

  protected async submitConsultation(target: AgendaAppointment): Promise<void> {
    if (!canOpenConsultation(target)) {
      this.consultationError.set('No se puede registrar la consulta: el plazo máximo de 8 horas tras la cita ha vencido.');
      return;
    }

    const diag = this.consultationDiagnosis().trim();
    if (diag.length > 0) {
      if (hasEmoji(diag)) {
        this.diagnosisValidationError.set('El diagnóstico no puede contener emojis.');
        return;
      }
      if (diag.length > 1000) {
        this.diagnosisValidationError.set('El diagnóstico no puede superar los 1000 caracteres.');
        return;
      }
      if (!isValidClinicalText(diag, 1000)) {
        this.diagnosisValidationError.set('El diagnóstico contiene caracteres no permitidos.');
        return;
      }
    }

    const treat = this.consultationTreatment().trim();
    if (treat.length > 0) {
      if (hasEmoji(treat)) {
        this.treatmentValidationError.set('El tratamiento no puede contener emojis.');
        return;
      }
      if (treat.length > 1000) {
        this.treatmentValidationError.set('El tratamiento no puede superar los 1000 caracteres.');
        return;
      }
      if (!isValidClinicalText(treat, 1000)) {
        this.treatmentValidationError.set('El tratamiento contiene caracteres no permitidos.');
        return;
      }
    }

    this.submittingConsultation.set(true);
    this.consultationError.set(null);
    try {
      await this.openConsultationUsecase.execute({
        appointmentId: target.id,
        diagnosis: diag || undefined,
        treatment: treat || undefined,
      });
      this.consultationTarget.set(null);
      this.notice.set(`Consulta registrada correctamente para ${target.patient?.name ?? 'el paciente'}.`);
      await this.load();
    } catch (error: any) {
      if (error?.status === 409 || error?.kind === 'conflict') {
        this.consultationError.set('La cita ya tiene una consulta registrada o no está en un estado válido para registrarla.');
      } else if (error?.status === 403 || error?.kind === 'forbidden') {
        this.consultationError.set('No tenés permiso para registrar esta consulta.');
      } else {
        this.consultationError.set(describeError(error).message);
      }
    } finally {
      this.submittingConsultation.set(false);
    }
  }

  // ── Cancel modal ──────────────────────────────────────────────────────────

  protected openCancelModal(appointment: AgendaAppointment): void {
    this.notice.set(null);
    this.cancellingTarget.set(appointment);
    this.cancelReasonCode.set('IMPREVISTO_MEDICO');
    this.cancelReasonText.set('');
    this.cancelValidationError.set(null);
    this.cancelError.set(null);
  }

  protected closeCancelModal(): void {
    this.cancellingTarget.set(null);
    this.cancelValidationError.set(null);
    this.cancelError.set(null);
  }

  protected onReasonInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const raw = target?.value ?? '';
    let cleaned = sanitizeFreeText(raw);
    if (raw.length > 0 && cleaned.trim().length === 0) {
      cleaned = '';
    }
    if (target && target.value !== cleaned) {
      target.value = cleaned;
    }
    if (this.cancelValidationError()) {
      this.cancelValidationError.set(null);
    }
    this.cancelReasonText.set(cleaned);
  }

  protected onReasonTextChange(text: string): void {
    // Emojis and symbols are removed as they are typed, so they are never stored or counted.
    if (this.cancelValidationError()) {
      this.cancelValidationError.set(null);
    }
    let cleaned = sanitizeFreeText(text);
    if (text.length > 0 && cleaned.trim().length === 0) {
      cleaned = '';
    }
    this.cancelReasonText.set(cleaned);
  }

  protected async submitCancel(target: AgendaAppointment): Promise<void> {
    if (!canCancelAppointment(target)) {
      this.cancelValidationError.set('No se puede cancelar una cita cuyo horario ya ha concluido.');
      return;
    }

    const reason = this.cancelReasonText().trim();
    if (!reason) {
      this.cancelValidationError.set('Ingresa el motivo de la cancelación.');
      return;
    }
    if (hasEmoji(reason)) {
      this.cancelValidationError.set('El motivo de la cancelación no puede contener emojis.');
      return;
    }
    if (reason.length > 1500) {
      this.cancelValidationError.set('El motivo de la cancelación no puede superar los 1500 caracteres.');
      return;
    }

    this.submittingCancel.set(true);
    this.cancelError.set(null);
    try {
      await this.cancelDoctorAppointment.execute({
        appointmentId: target.id,
        code: this.cancelReasonCode(),
        reason,
      });
      this.cancellingTarget.set(null);
      this.notice.set('Cita cancelada con éxito.');
      await this.load();
    } catch (error: any) {
      if (error?.status === 409 || error?.kind === 'conflict') {
        this.cancelError.set('Necesita la aprobación del administrador');
        // Criterion: 409 reloads the agenda so the appointment is never in an uncertain state
        await this.load();
      } else if (error?.status === 422 || error?.kind === 'validation') {
        this.cancelError.set('El motivo de la cancelación es inválido.');
      } else {
        this.cancelError.set(describeError(error).message);
      }
    } finally {
      this.submittingCancel.set(false);
    }
  }

  // ── Formatters ────────────────────────────────────────────────────────────

  protected dateOf(utc: string): string {
    return formatBranchDate(utc);
  }

  protected timeRangeOf(startUtc: string, endUtc: string): string {
    return formatBranchTimeRange(startUtc, endUtc);
  }

  protected statusLabel(status: AppointmentStatus): string {
    return APPOINTMENT_STATUS_LABELS[status] ?? status;
  }

  protected statusTone(status: AppointmentStatus) {
    return APPOINTMENT_STATUS_TONES[status] ?? 'info';
  }

  protected isElapsed(appointment: AgendaAppointment): boolean {
    return isAppointmentElapsed(appointment);
  }
}
