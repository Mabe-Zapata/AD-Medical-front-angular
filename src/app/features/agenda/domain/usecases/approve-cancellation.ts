import { AppError } from '../../../../core/domain/app-error';
import { isUuid } from '../../../../core/domain/dates';
import { ApproveCancellationCommand, CancellationApprovalResult } from '../entities/appointment';
import { AgendaRepository } from '../ports/agenda.ports';

export class ApproveCancellation {
  constructor(private readonly repository: AgendaRepository) {}

  async execute(command: ApproveCancellationCommand): Promise<CancellationApprovalResult> {
    const appointmentId = command.appointmentId?.trim() ?? '';
    if (!isUuid(appointmentId)) {
      throw new AppError('validation', 'El identificador de la cita debe ser un UUID válido.');
    }

    const reason = command.reason?.trim() ?? '';
    if (reason.length < 1) {
      throw new AppError('validation', 'El motivo de la aprobación es obligatorio.');
    }
    if (reason.length > 1500) {
      throw new AppError(
        'validation',
        'El motivo de la aprobación no puede superar los 1500 caracteres.',
      );
    }

    return this.repository.approveCancellation({
      appointmentId,
      reason,
    });
  }
}
