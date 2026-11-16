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

export interface AppointmentDoctor {
  readonly id: string;
  readonly name: string;
  readonly professionalRegistration?: string | null;
  readonly phone?: string | null;
}

/** One appointment summary in the doctor's agenda or admin listing. */
export interface AgendaAppointment {
  readonly id: string;
  readonly status: AppointmentStatus;
  /** ISO-8601 UTC timestamp. */
  readonly startUtc: string;
  /** ISO-8601 UTC timestamp. */
  readonly endUtc: string;
  /** Additive field: present on doctor's agenda rows; null when absent. */
  readonly patient: AppointmentPatient | null;
  /** Additive field: present on admin listing rows; null when absent. */
  readonly doctor?: AppointmentDoctor | null;
  /** Additive field: true when cancellation approval is already registered. */
  readonly hasApproval?: boolean;
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
