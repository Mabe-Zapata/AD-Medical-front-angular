import { isPastUtc } from '../../../../core/time/branch-time';

/** Backend citas.estado enum. */
export type AppointmentStatus =
  | 'CANCELADA'
  | 'COMPLETADA'
  | 'CONFIRMADA'
  | 'EXPIRADA'
  | 'NO_ASISTIO'
  | 'PENDIENTE_PAGO';

export interface AppointmentPatient {
  readonly id: string;
  readonly name: string;
}

/** One appointment summary in the doctor's agenda. */
export interface AgendaAppointment {
  readonly id: string;
  readonly status: AppointmentStatus;
  /** ISO-8601 UTC timestamp. */
  readonly startUtc: string;
  /** ISO-8601 UTC timestamp. */
  readonly endUtc: string;
  /** The patient of this agenda row. */
  readonly patient: AppointmentPatient | null;
}

/** The doctor of a cancellation review row. Never a patient, never a phone number. */
export interface CancellationCandidateDoctor {
  readonly id: string;
  readonly name: string;
  readonly professionalRegistration: string | null;
}

/** One appointment in the administrator's cancellation review (identity only). */
export interface CancellationCandidate {
  readonly id: string;
  readonly status: AppointmentStatus;
  /** ISO-8601 UTC timestamp. */
  readonly startUtc: string;
  /** ISO-8601 UTC timestamp. */
  readonly endUtc: string;
  readonly doctor: CancellationCandidateDoctor;
  /** True when cancellation approval is already registered. */
  readonly hasApproval: boolean;
}

export type DoctorCancellationCode = 'IMPREVISTO_MEDICO' | 'OTRO_MEDICO';

export interface CancelDoctorAppointmentCommand {
  readonly appointmentId: string;
  readonly code: DoctorCancellationCode;
  readonly reason: string;
}

export interface ApproveCancellationCommand {
  readonly appointmentId: string;
  readonly reason: string;
}

export interface CancellationApprovalResult {
  readonly appointmentId: string;
  readonly approved: boolean;
}

/**
 * Returns true if a confirmed appointment's scheduled slot has concluded
 * but has not yet been registered as attended/completed.
 */
export function isAppointmentElapsed(
  appointment: Pick<AgendaAppointment, 'status' | 'endUtc'>,
  nowMillis = Date.now(),
): boolean {
  return appointment.status === 'CONFIRMADA' && isPastUtc(appointment.endUtc, nowMillis);
}

/**
 * Returns true if an appointment can be cancelled by the doctor:
 * must be CONFIRMADA or PENDIENTE_PAGO, and its scheduled slot must not be in the past.
 */
export function canCancelAppointment(
  appointment: Pick<AgendaAppointment, 'status' | 'endUtc'>,
  nowMillis = Date.now(),
): boolean {
  if (appointment.status !== 'CONFIRMADA' && appointment.status !== 'PENDIENTE_PAGO') {
    return false;
  }
  return !isPastUtc(appointment.endUtc, nowMillis);
}

export const MAX_CONSULTATION_HOURS = 8;
export const MAX_CONSULTATION_WINDOW_MS = MAX_CONSULTATION_HOURS * 60 * 60 * 1000;

/**
 * Returns true if an appointment's consultation window has expired
 * (more than 8 hours after the slot's scheduled end time).
 */
export function isConsultationExpired(
  endUtc: string,
  nowMillis = Date.now(),
): boolean {
  const end = new Date(endUtc).getTime();
  if (Number.isNaN(end)) return false;
  return nowMillis - end > MAX_CONSULTATION_WINDOW_MS;
}

/**
 * Returns true if a doctor can register attendance/consultation for an appointment:
 * - Must be in CONFIRMADA or COMPLETADA status.
 * - Allowed only up to 8 hours after the appointment's scheduled end time.
 */
export function canOpenConsultation(
  appointment: Pick<AgendaAppointment, 'status' | 'endUtc'>,
  nowMillis = Date.now(),
): boolean {
  if (appointment.status !== 'CONFIRMADA' && appointment.status !== 'COMPLETADA') {
    return false;
  }
  return !isConsultationExpired(appointment.endUtc, nowMillis);
}

/** Command to open (register) the consultation for an appointment. */
export interface OpenConsultationCommand {
  readonly appointmentId: string;
  readonly diagnosis?: string;
  readonly treatment?: string;
}

/** Returned by the backend after opening a consultation. */
export interface ConsultationResult {
  readonly id: string;
  readonly appointmentId: string;
  readonly estado: 'ABIERTA' | 'CERRADA';
  readonly inicioAtencion: string | null;
  readonly motivoConsulta: string | null;
}
