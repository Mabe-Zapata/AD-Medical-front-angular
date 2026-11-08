// Mirrors the laboratory and clinical tables of the backend. Field names are English; the values
// (SOLICITADA, ACEPTAR, ...) are the backend's own codes.

export interface OrderTest {
  /** Identifies one test inside the order; results are entered against it. */
  readonly detailId: string;
  readonly testTypeId: string;
  readonly status: string;
}

export interface LabOrder {
  readonly id: string;
  readonly patientId: string;
  readonly priority: string;
  readonly status: string;
  readonly notes: string | null;
  readonly tests: readonly OrderTest[];
}

export interface LabResult {
  readonly id: string;
  readonly detailId: string;
  readonly analyteName: string;
  readonly unit: string | null;
  readonly numericValue: number | null;
  readonly textValue: string | null;
}

/** A result typed by hand. The analyte id links it to the clinical knowledge, so it can be classified. */
export interface NewResult {
  readonly analyteId: string | null;
  readonly analyteName: string;
  readonly unit: string | null;
  readonly numericValue: number | null;
  readonly textValue: string | null;
}

export interface Evidence {
  readonly resultId: string;
  readonly observedValue: number | null;
  readonly unit: string | null;
}

export interface Finding {
  readonly id: string;
  readonly ruleCode: string;
  readonly ruleVersion: number;
  readonly type: string;
  readonly explanation: string;
  readonly reviewStatus: string;
  readonly evidence: readonly Evidence[];
}

/** The preliminary output of the deterministic engine. It is never a diagnosis. */
export interface Proposal {
  readonly id: string;
  readonly orderId: string;
  readonly status: string;
  readonly summary: string;
  readonly notice: string;
  readonly engineVersion: string;
  readonly decision: string | null;
  readonly medicalConclusion: string | null;
  readonly findings: readonly Finding[];
}

export const DECISIONS = ['ACEPTAR', 'CORREGIR', 'RECHAZAR'] as const;
export type Decision = (typeof DECISIONS)[number];

export interface UploadedReport {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

export const PRIORITIES = ['NORMAL', 'URGENTE'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** What a doctor gives to create an order. The patient and the tests are identified by UUID. */
export interface NewOrder {
  readonly patientId: string;
  readonly testTypeIds: readonly string[];
  readonly priority: Priority;
  readonly notes: string | null;
}
