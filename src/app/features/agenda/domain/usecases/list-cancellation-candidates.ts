import { CancellationCandidate } from '../entities/appointment';
import { AgendaRepository, ListCancellationCandidatesFilter } from '../ports/agenda.ports';

export class ListCancellationCandidates {
  constructor(private readonly repository: AgendaRepository) {}

  execute(filter?: ListCancellationCandidatesFilter): Promise<readonly CancellationCandidate[]> {
    return this.repository.listCancellationCandidates(filter);
  }
}
