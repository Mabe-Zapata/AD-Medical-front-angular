// Mirrors the clinical knowledge tables of the backend (conocimiento_*). Field names are English;
// the values (NUMERICO, HALLAZGO, ...) are the backend's own codes.

export const VALUE_TYPES = ['NUMERICO', 'TEXTO', 'CODIFICADO'] as const;
export type ValueType = (typeof VALUE_TYPES)[number];

export const RULE_TYPES = ['HALLAZGO', 'HIPOTESIS', 'ALERTA'] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export const RULE_LOGICS = ['TODOS', 'CUALQUIERA'] as const;
export type RuleLogic = (typeof RULE_LOGICS)[number];

export const RULE_PRIORITIES = ['INFORMATIVA', 'REVISION_MEDICA', 'URGENTE'] as const;
export type RulePriority = (typeof RULE_PRIORITIES)[number];

export const NUMERIC_OPERATORS = ['LT', 'LE', 'GT', 'GE', 'EQ'] as const;
export const STATUS_OPERATORS = ['FUERA_REFERENCIA', 'DENTRO_REFERENCIA'] as const;
export const OPERATORS = [...NUMERIC_OPERATORS, ...STATUS_OPERATORS] as const;
export type Operator = (typeof OPERATORS)[number];

export interface Analyte {
  readonly id: string;
  readonly name: string;
  readonly unit: string | null;
  readonly valueType: string;
}

export interface NewAnalyte {
  readonly name: string;
  readonly unit: string | null;
  readonly valueType: ValueType;
}

/** A validated reference range (the API never lists drafts). */
export interface ReferenceRange {
  readonly id: string;
  readonly version: number;
  readonly unit: string;
  readonly min: number | null;
  readonly max: number | null;
  readonly sex: string | null;
  readonly minAgeDays: number | null;
  readonly maxAgeDays: number | null;
  readonly method: string | null;
  readonly sampleType: string | null;
  readonly context: string | null;
  /** `yyyy-mm-dd` */
  readonly startDate: string;
  readonly endDate: string | null;
}

export interface NewReference {
  readonly sourceId: string;
  readonly unit: string;
  readonly min: number | null;
  readonly max: number | null;
  readonly sex: string | null;
  readonly minAgeDays: number | null;
  readonly maxAgeDays: number | null;
  readonly method: string | null;
  readonly sampleType: string | null;
  readonly context: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
}

export interface Criterion {
  readonly analyteId: string;
  readonly operator: Operator;
  readonly threshold: number | null;
  readonly unit: string | null;
}

export interface NewRule {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: RuleType;
  readonly logic: RuleLogic;
  readonly message: string;
  readonly priority: RulePriority;
  readonly criteria: readonly Criterion[];
}

/** A draft rule as the listing returns it. */
export interface RuleDraft {
  readonly id: string;
  readonly code: string;
  readonly version: number;
  readonly name: string | null;
}

/** A draft reference range as the listing returns it. */
export interface ReferenceDraft {
  readonly id: string;
  readonly analyteId: string;
  readonly version: number;
  readonly unit: string;
  readonly min: number | null;
  readonly max: number | null;
}

/** A draft shown in the drafts screen: from the listing, or one this session just created. */
export interface Draft {
  readonly kind: 'reference' | 'rule';
  readonly id: string;
  readonly label: string;
  readonly state: 'BORRADOR' | 'VALIDADA';
}
