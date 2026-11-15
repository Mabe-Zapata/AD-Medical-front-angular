// Shadow findings: what the engine would conclude, shown next to the normal flow. They never change the
// order, the results or the physician's decision. Field names are English; the codes are the backend's own.

/** The findings a physician can act on (the path segment of the edit endpoints). */
export const EDITABLE_FINDINGS = ['ANEMIA', 'HIERRO', 'DIABETES'] as const;
export type EditableFinding = (typeof EDITABLE_FINDINGS)[number];

export interface Cutoff {
  readonly value: number;
  readonly unit: string;
}

/** One finding of the live (not stored) shadow read. */
export interface ShadowFinding {
  /** The editable ones plus `MICROCITOSIS`, a supporting signal that is read-only. */
  readonly key: EditableFinding | 'MICROCITOSIS';
  readonly category: string;
  readonly cutoff: Cutoff | null;
  readonly reason: string | null;
  readonly source: string | null;
  /** A caution that must be read together with the finding. */
  readonly notice: string | null;
}

export interface ShadowReport {
  readonly findings: readonly ShadowFinding[];
}

export interface ShadowEvidence {
  readonly role: string;
  readonly resultId: string;
  readonly value: number;
  readonly unit: string | null;
}

/** One finding frozen in a snapshot, with the evidence it was computed from. */
export interface ShadowSnapshotItem {
  readonly finding: EditableFinding;
  readonly category: string;
  readonly cutoff: Cutoff | null;
  readonly source: string | null;
  readonly reason: string | null;
  readonly evidence: readonly ShadowEvidence[];
}

/** An immutable record: it is never updated or deleted, a new one is taken instead. */
export interface ShadowSnapshot {
  readonly id: string;
  readonly ruleVersion: string;
  /** ISO date-time. */
  readonly createdAt: string;
  readonly items: readonly ShadowSnapshotItem[];
}

export const SHADOW_ACTIONS = ['CONFIRMAR', 'DESCARTAR', 'MODIFICAR'] as const;
export type ShadowAction = (typeof SHADOW_ACTIONS)[number];

/** One physician action on one finding. The history is append-only: the suggestion is never overwritten. */
export interface ShadowEdit {
  readonly id: string;
  readonly action: ShadowAction;
  readonly previousCategory: string;
  readonly newCategory: string;
  readonly reason: string;
  /** ISO date-time. */
  readonly createdAt: string;
}

export interface NewShadowEdit {
  readonly action: ShadowAction;
  /** Only for `MODIFICAR`. */
  readonly newCategory: string | null;
  readonly reason: string;
}
