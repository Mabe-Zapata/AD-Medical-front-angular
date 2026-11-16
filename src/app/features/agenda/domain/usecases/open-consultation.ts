import { Injectable } from '@angular/core';

import { AppError } from '../../../../core/domain/app-error';
import {
  hasEmoji,
  isValidClinicalText,
  sanitizeClinicalText,
} from '../../../../core/domain/text';
import { ConsultationResult, OpenConsultationCommand } from '../entities/appointment';
import { AgendaRepository } from '../ports/agenda.ports';

@Injectable()
export class OpenConsultation {
  constructor(private readonly repository: AgendaRepository) {}

  async execute(command: OpenConsultationCommand): Promise<ConsultationResult> {
    const diag = command.diagnosis?.trim() ?? '';
    if (diag.length > 0) {
      if (hasEmoji(diag)) {
        throw new AppError('validation', 'El diagnóstico no puede contener emojis.');
      }
      if (diag.length > 1000) {
        throw new AppError('validation', 'El diagnóstico no puede superar los 1000 caracteres.');
      }
      if (!isValidClinicalText(diag, 1000)) {
        throw new AppError('validation', 'El diagnóstico contiene caracteres no permitidos.');
      }
    }

    const treat = command.treatment?.trim() ?? '';
    if (treat.length > 0) {
      if (hasEmoji(treat)) {
        throw new AppError('validation', 'El tratamiento no puede contener emojis.');
      }
      if (treat.length > 1000) {
        throw new AppError('validation', 'El tratamiento no puede superar los 1000 caracteres.');
      }
      if (!isValidClinicalText(treat, 1000)) {
        throw new AppError('validation', 'El tratamiento contiene caracteres no permitidos.');
      }
    }

    return this.repository.openConsultation({
      appointmentId: command.appointmentId,
      diagnosis: diag ? sanitizeClinicalText(diag) : undefined,
      treatment: treat ? sanitizeClinicalText(treat) : undefined,
    });
  }
}

