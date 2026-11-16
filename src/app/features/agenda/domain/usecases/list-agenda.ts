import { AgendaAppointment } from '../entities/appointment';
import { AgendaRepository, ListAgendaFilter } from '../ports/agenda.ports';

export class ListAgenda {
  constructor(private readonly repository: AgendaRepository) {}

  execute(filter?: ListAgendaFilter): Promise<readonly AgendaAppointment[]> {
    return this.repository.listAppointments(filter);
  }
}
