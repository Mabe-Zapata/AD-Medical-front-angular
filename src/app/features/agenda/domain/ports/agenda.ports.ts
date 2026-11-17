import {
  AgendaAppointment,
  AppointmentStatus,
  ApproveCancellationCommand,
  CancellationApprovalResult,
  CancellationCandidate,
  CancelDoctorAppointmentCommand,
  ConsultationResult,
  OpenConsultationCommand,
} from '../entities/appointment';

export interface ListAgendaFilter {
  readonly status?: AppointmentStatus | null;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListCancellationCandidatesFilter {
  readonly status?: AppointmentStatus | null;
  /** Exact doctor registration number. Blank or missing means no filter. */
  readonly doctorRegistration?: string | null;
  readonly limit?: number;
  readonly offset?: number;
}

export abstract class AgendaRepository {
  abstract listAppointments(filter?: ListAgendaFilter): Promise<readonly AgendaAppointment[]>;
  abstract listCancellationCandidates(
    filter?: ListCancellationCandidatesFilter,
  ): Promise<readonly CancellationCandidate[]>;
  abstract cancelAppointment(command: CancelDoctorAppointmentCommand): Promise<void>;
  abstract approveCancellation(
    command: ApproveCancellationCommand,
  ): Promise<CancellationApprovalResult>;
  abstract openConsultation(command: OpenConsultationCommand): Promise<ConsultationResult>;
}
