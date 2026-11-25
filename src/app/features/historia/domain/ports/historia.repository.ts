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

/** Port to the clinical history API. Implementations throw `AppError`. */
export abstract class HistoriaRepository {
  /** The patients the signed-in doctor treats (an appointment or a lab order), one name per row. */
  abstract listPatients(): Promise<PatientOption[]>;
  /** The history of one patient, limited to a date range when one is given. */
  abstract readHistory(patientId: string, range: DateRange): Promise<ClinicalHistory>;
  abstract readEvents(patientId: string, filter: EventFilter): Promise<EventPage>;
  /** Returns the entry as the backend stored it. A doctor's entry comes back verified. */
  abstract createEntry(patientId: string, draft: EntryDraft): Promise<HistoryEntry>;
  abstract verifyEntry(patientId: string, kind: EntryKind, entryId: string): Promise<HistoryEntry>;
  abstract changeState(
    patientId: string,
    kind: EntryKind,
    entryId: string,
    change: { expected: string; target: string; reason: string },
  ): Promise<HistoryEntry>;
  abstract recordVitals(appointmentId: string, measures: VitalMeasures): Promise<VitalSigns>;
  abstract correctVitals(vitalsId: string, measures: VitalMeasures, reason: string): Promise<VitalSigns>;
  abstract searchCatalog(catalog: CatalogName, query: string | null, limit: number): Promise<CatalogItem[]>;
}
