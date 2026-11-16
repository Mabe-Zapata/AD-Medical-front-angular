import {
  AgendaAppointment,
  AppointmentStatus,
  ApproveCancellationCommand,
  CancellationApprovalResult,
  CancelDoctorAppointmentCommand,
} from '../entities/appointment';

export interface ListAgendaFilter {
  readonly status?: AppointmentStatus | null;
  readonly limit?: number;
  readonly offset?: number;
}

export abstract class AgendaRepository {
  abstract listAppointments(filter?: ListAgendaFilter): Promise<readonly AgendaAppointment[]>;
  abstract cancelAppointment(command: CancelDoctorAppointmentCommand): Promise<void>;
  abstract approveCancellation(
    command: ApproveCancellationCommand,
  ): Promise<CancellationApprovalResult>;
}
