import { AppError } from '../../../../core/domain/app-error';
import { hasEmoji } from '../../../../core/domain/text';
import { CancelDoctorAppointmentCommand } from '../entities/appointment';
import { AgendaRepository } from '../ports/agenda.ports';

export class CancelDoctorAppointment {
  constructor(private readonly repository: AgendaRepository) {}

  async execute(command: CancelDoctorAppointmentCommand): Promise<void> {
    const trimmed = command.reason?.trim() ?? '';
    if (trimmed.length < 1) {
      throw new AppError('validation', 'El motivo de la cancelación es obligatorio.');
    }
    if (hasEmoji(command.reason ?? '')) {
      throw new AppError('validation', 'El motivo de la cancelación no puede contener emojis.');
    }
    if (trimmed.length > 1500) {
      throw new AppError('validation', 'El motivo de la cancelación no puede superar los 1500 caracteres.');
    }
    return this.repository.cancelAppointment({
      ...command,
      reason: trimmed,
    });
  }
}
