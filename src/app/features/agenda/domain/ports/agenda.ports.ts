import {
  AgendaAppointment,
  AppointmentStatus,
  ApproveCancellationCommand,
  CancellationApprovalResult,
  CancelDoctorAppointmentCommand,
  ConsultationResult,
  OpenConsultationCommand,
} from '../entities/appointment';

export interface ListAgendaFilter {
  readonly status?: AppointmentStatus | null;
  readonly doctorRegistration?: string | null;
  readonly limit?: number;
  readonly offset?: number;
}

export abstract class AgendaRepository {
  abstract listAppointments(filter?: ListAgendaFilter): Promise<readonly AgendaAppointment[]>;
  abstract cancelAppointment(command: CancelDoctorAppointmentCommand): Promise<void>;
  abstract approveCancellation(
    command: ApproveCancellationCommand,
  ): Promise<CancellationApprovalResult>;
  abstract openConsultation(command: OpenConsultationCommand): Promise<ConsultationResult>;
}
