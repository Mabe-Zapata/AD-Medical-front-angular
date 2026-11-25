// The clinical history of one patient, as the staff system reads it. Field names are English; the
// backend's Spanish names are translated in the data layer.

export type EntryKind = 'allergy' | 'antecedent' | 'medication' | 'problem' | 'vaccine';

export type EntryOrigin = 'DOCTOR' | 'PATIENT';

export type AllergySeverity = 'LEVE' | 'MODERADA' | 'GRAVE' | 'DESCONOCIDA';
export type AntecedentType = 'PERSONAL' | 'FAMILIAR' | 'QUIRURGICO';

export type EntryDetails =
  | {
      readonly kind: 'allergy';
      readonly substanceCode: string;
      readonly substance: string;
      readonly category: string;
      readonly severity: AllergySeverity;
      readonly reaction: string | null;
    }
  | {
      readonly kind: 'antecedent';
      readonly type: AntecedentType;
      readonly description: string;
      readonly relative: string | null;
      readonly cie11: string | null;
    }
  | {
      readonly kind: 'medication';
      readonly name: string;
      readonly dose: string | null;
      readonly frequency: string | null;
      readonly startDate: string | null;
    }
  | {
      readonly kind: 'problem';
      readonly description: string;
      readonly cie11: string | null;
      readonly startDate: string | null;
    }
  | {
      readonly kind: 'vaccine';
      readonly code: string;
      readonly name: string;
      readonly doseNumber: number;
      readonly date: string;
      readonly lot: string | null;
    };

export interface HistoryEntry {
  readonly id: string;
  /** The state as the backend names it (ACTIVA, ACTIVO, SUSPENDIDA, ERRONEA...). */
  readonly state: string | null;
  readonly origin: EntryOrigin;
  readonly verified: boolean;
  readonly verifiedAt: string | null;
  readonly recordedAt: string | null;
  readonly details: EntryDetails;
}

export interface VitalMeasures {
  readonly weightKg: number | null;
  readonly heightCm: number | null;
  readonly systolic: number | null;
  readonly diastolic: number | null;
  readonly heartRate: number | null;
  readonly temperatureC: number | null;
  readonly oxygen: number | null;
}

export interface VitalSigns extends VitalMeasures {
  readonly id: string;
  readonly appointmentId: string;
  readonly recordedAt: string | null;
  /** The entry this one corrects, when it is a correction. */
  readonly correctsId: string | null;
  readonly reason: string | null;
}

export interface ClinicalHistory {
  readonly patientId: string;
  readonly allergies: readonly HistoryEntry[];
  readonly antecedents: readonly HistoryEntry[];
  readonly medications: readonly HistoryEntry[];
  readonly problems: readonly HistoryEntry[];
  readonly vaccines: readonly HistoryEntry[];
  readonly vitals: readonly VitalSigns[];
}

export interface HistoryEvent {
  readonly id: number;
  readonly entity: string;
  readonly entityId: string;
  readonly action: 'CREAR' | 'VERIFICAR' | 'ESTADO' | 'CORREGIR';
  readonly reason: string | null;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly at: string;
  /** Only present for the treating doctor; the patient never sees who acted. */
  readonly actorId: string | null;
}

export interface EventPage {
  readonly items: readonly HistoryEvent[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly includesActor: boolean;
}

export interface CatalogItem {
  readonly code: string;
  readonly name: string;
  /** Only for the allergen catalog. */
  readonly category: string | null;
}

export type CatalogName = 'cie11' | 'vacunas' | 'sustancias-alergia';

/** Calendar days, inclusive. Either side may be open. */
export interface DateRange {
  readonly from?: string | null;
  readonly to?: string | null;
}

export interface EventFilter extends DateRange {
  readonly entity?: string;
  readonly action?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface PatientOption {
  readonly id: string;
  readonly name: string;
}

/** What the staff can write. Catalog codes, never free-text allergens or vaccines. */
export type EntryDraft =
  | { readonly kind: 'allergy'; readonly substanceCode: string; readonly severity: AllergySeverity; readonly reaction: string | null }
  | { readonly kind: 'antecedent'; readonly type: AntecedentType; readonly description: string; readonly relative: string | null; readonly cie11: string | null }
  | { readonly kind: 'medication'; readonly name: string; readonly dose: string | null; readonly frequency: string | null; readonly startDate: string | null }
  | { readonly kind: 'problem'; readonly description: string; readonly cie11: string | null; readonly startDate: string | null }
  | { readonly kind: 'vaccine'; readonly vaccineCode: string; readonly doseNumber: number; readonly date: string; readonly lot: string | null };

export const ENTRY_KIND_PATH: Readonly<Record<EntryKind, string>> = {
  allergy: 'alergias',
  antecedent: 'antecedentes',
  medication: 'medicacion',
  problem: 'problemas',
  vaccine: 'vacunas',
};
