import { Analyte, NewAnalyte, NewReference, NewRule, ReferenceRange } from '../entities/knowledge';

/** Port to the clinical knowledge API. */
export abstract class KnowledgeRepository {
  abstract listAnalytes(): Promise<Analyte[]>;
  abstract createAnalyte(analyte: NewAnalyte): Promise<string>;
  /** `onDate` is `yyyy-mm-dd`; null lets the backend use today. */
  abstract listReferences(analyteId: string, onDate: string | null): Promise<ReferenceRange[]>;
  abstract createReference(analyteId: string, reference: NewReference): Promise<string>;
  abstract validateReference(referenceId: string): Promise<void>;
  abstract createRule(rule: NewRule): Promise<string>;
  abstract validateRule(ruleId: string): Promise<void>;
}
