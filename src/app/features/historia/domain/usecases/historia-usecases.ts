import { AppError } from '../../../../core/domain/app-error';
import type {
  CatalogItem,
  CatalogName,
  ClinicalHistory,
  DateRange,
  EntryDraft,
  EntryKind,
  EventFilter,
  EventPage,
  HistoryEntry,
  PatientOption,
  VitalMeasures,
  VitalSigns,
} from '../entities/historia';
import {
  validateAllergy,
  validateAntecedent,
  validateMedication,
  validateMotivo,
  validateProblem,
  validateRange,
  validateVaccine,
  validateVitals,
} from '../policies/historia-policies';
import { HistoriaRepository } from '../ports/historia.repository';

/** Today in the clinic's calendar, as YYYY-MM-DD. The clock is passed in so tests can fix it. */
export type Today = () => string;

const invalid = (fields: readonly string[]): AppError =>
  new AppError('validation', `Invalid fields: ${fields.join(', ')}`);

export class ListHistoryPatients {
  constructor(private readonly repository: HistoriaRepository) {}

async execute(): Promise<PatientOption[]> {
    return this.repository.listPatients();
  }
}

export class ReadHistory {
  constructor(
    private readonly repository: HistoriaRepository,
    private readonly today: Today,
  ) {}

async execute(patientId: string, range: DateRange): Promise<ClinicalHistory> {
    const problems = validateRange(range, this.today());
    if (problems.length > 0) throw invalid(problems);
    return this.repository.readHistory(patientId, range);
  }
}

export class ReadEvents {
  constructor(
    private readonly repository: HistoriaRepository,
    private readonly today: Today,
  ) {}

async execute(patientId: string, filter: EventFilter): Promise<EventPage> {
    const problems = validateRange(filter, this.today());
    if (problems.length > 0) throw invalid(problems);
    return this.repository.readEvents(patientId, filter);
  }
}

export class CreateEntry {
  constructor(
    private readonly repository: HistoriaRepository,
    private readonly today: Today,
  ) {}

async execute(patientId: string, draft: EntryDraft): Promise<HistoryEntry> {
    const problems = checkDraft(draft, this.today());
    if (problems.length > 0) throw invalid(problems);
    return this.repository.createEntry(patientId, draft);
  }
}

export class VerifyEntry {
  constructor(private readonly repository: HistoriaRepository) {}

async execute(patientId: string, kind: EntryKind, entryId: string): Promise<HistoryEntry> {
    return this.repository.verifyEntry(patientId, kind, entryId);
  }
}

export class ChangeEntryState {
  constructor(private readonly repository: HistoriaRepository) {}

async execute(
    patientId: string,
    kind: EntryKind,
    entryId: string,
    change: { expected: string; target: string; reason: string },
  ): Promise<HistoryEntry> {
    const problems = validateMotivo(change.reason);
    if (problems.length > 0) throw invalid(problems);
    return this.repository.changeState(patientId, kind, entryId, change);
  }
}

export class RecordVitals {
  constructor(private readonly repository: HistoriaRepository) {}

async execute(appointmentId: string, measures: VitalMeasures): Promise<VitalSigns> {
    const problems = validateVitals(measures);
    if (problems.length > 0) throw invalid(problems);
    return this.repository.recordVitals(appointmentId, measures);
  }
}

export class CorrectVitals {
  constructor(private readonly repository: HistoriaRepository) {}

async execute(vitalsId: string, measures: VitalMeasures, reason: string): Promise<VitalSigns> {
    const problems = [...validateVitals(measures), ...validateMotivo(reason)];
    if (problems.length > 0) throw invalid(problems);
    return this.repository.correctVitals(vitalsId, measures, reason);
  }
}

export class SearchCatalog {
  constructor(private readonly repository: HistoriaRepository) {}

async execute(catalog: CatalogName, query: string | null): Promise<CatalogItem[]> {
    return this.repository.searchCatalog(catalog, query, 20);
  }
}

function checkDraft(draft: EntryDraft, today: string): readonly string[] {
  switch (draft.kind) {
    case 'allergy':
      return validateAllergy(draft);
    case 'antecedent':
      return validateAntecedent(draft);
    case 'medication':
      return validateMedication(draft);
    case 'problem':
      return validateProblem(draft);
    case 'vaccine':
      return validateVaccine(
        { vaccineCode: draft.vaccineCode, doseNumber: draft.doseNumber, date: draft.date, lot: draft.lot },
        today,
      );
  }
}
