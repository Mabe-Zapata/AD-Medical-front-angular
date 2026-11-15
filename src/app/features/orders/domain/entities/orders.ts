// Mirrors the laboratory and clinical tables of the backend. Field names are English; the values
// (SOLICITADA, ACEPTAR, ...) are the backend's own codes.

/** A laboratory test the doctor can tick on the order form. */
export interface TestTypeOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** A patient the doctor treats, as offered by the order form. */
export interface PatientOption {
  readonly id: string;
  readonly name: string;
}

/** One row of the order listing: it carries no tests and no results. */
export interface OrderSummary {
  readonly id: string;
  readonly patientId: string;
  readonly status: string;
  /** ISO date-time the order was placed. */
  readonly orderedAt: string;
}

export interface OrderTest {
  /** Identifies one test inside the order; results are entered against it. */
  readonly detailId: string;
  readonly testTypeId: string;
  readonly status: string;
  /** Set on the worklist only: the test's name and code, so the queue reads by name. */
  readonly name?: string;
  readonly code?: string;
}

/** An uploaded report of an order. Metadata only; the file comes from the download route. */
export interface OrderDocument {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
}

/** An analyte a test asks for. Mandatory ones make the test complete. */
export interface TestAnalyte {
  readonly id: string;
  readonly name: string;
  readonly unit: string | null;
  readonly valueType: string;
  readonly mandatory: boolean;
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

/** One pending order of the laboratory worklist: both origins, oldest first, with its test lines. */
export interface WorklistOrder {
  readonly id: string;
  /** 'PACIENTE' when the patient asked for the exam, 'MEDICO' when a doctor ordered it. */
  readonly origin: string;
  readonly priority: string;
  readonly status: string;
  readonly orderedAt: string;
  /** The patient's name, for the laboratory to match the sample to the person. Null when unknown. */
  readonly patientName: string | null;
  readonly tests: readonly OrderTest[];
}
