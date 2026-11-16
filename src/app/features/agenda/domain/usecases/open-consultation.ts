import { Injectable } from '@angular/core';

import { ConsultationResult, OpenConsultationCommand } from '../entities/appointment';
import { AgendaRepository } from '../ports/agenda.ports';

@Injectable()
export class OpenConsultation {
  constructor(private readonly repository: AgendaRepository) {}

  async execute(command: OpenConsultationCommand): Promise<ConsultationResult> {
    return this.repository.openConsultation(command);
  }
}
