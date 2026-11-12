import { AppError } from '../../../../core/domain/app-error';
import { isUuid } from '../../../../core/domain/dates';
import {
  Analyte,
  Draft,
  KnowledgeSummary,
  NewAnalyte,
  NewReference,
  NewRule,
  ReferenceRange,
} from '../entities/knowledge';
import {
  normalizeCriterion,
  referenceProblems,
  ruleProblems,
} from '../policies/knowledge-policies';
import { KnowledgeRepository } from '../ports/knowledge.repository';

export class ListAnalytes {
  constructor(private readonly repository: KnowledgeRepository) {}

  async execute(): Promise<Analyte[]> {
    const analytes = await this.repository.listAnalytes();
    return [...analytes].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}

export class CreateAnalyte {
  constructor(private readonly repository: KnowledgeRepository) {}

  execute(analyte: NewAnalyte): Promise<string> {
    const name = analyte.name.trim();
    if (!name) throw new AppError('validation', 'name is required');
    return this.repository.createAnalyte({ ...analyte, name, unit: analyte.unit?.trim() || null });
  }
}

export class ListReferences {
  constructor(private readonly repository: KnowledgeRepository) {}

  execute(analyteId: string, onDate: string | null): Promise<ReferenceRange[]> {
    return this.repository.listReferences(analyteId, onDate);
  }
}

export class CreateReferenceDraft {
  constructor(private readonly repository: KnowledgeRepository) {}

  execute(analyteId: string, reference: NewReference): Promise<string> {
    if (!isUuid(reference.sourceId)) throw new AppError('validation', 'source id must be a UUID');
    const problems = referenceProblems(reference);
    if (problems.length > 0) throw new AppError('validation', problems.join(', '));
    return this.repository.createReference(analyteId, reference);
  }
}

export class ValidateReference {
  constructor(private readonly repository: KnowledgeRepository) {}

  execute(referenceId: string): Promise<void> {
    if (!isUuid(referenceId)) throw new AppError('validation', 'reference id must be a UUID');
    return this.repository.validateReference(referenceId.trim());
  }
}

export class CreateRuleDraft {
  constructor(private readonly repository: KnowledgeRepository) {}

  execute(rule: NewRule): Promise<string> {
    const normalized: NewRule = { ...rule, criteria: rule.criteria.map(normalizeCriterion) };
    const problems = ruleProblems(normalized);
    if (problems.length > 0) throw new AppError('validation', problems.join(', '));
    return this.repository.createRule(normalized);
  }
}

export class ValidateRule {
  constructor(private readonly repository: KnowledgeRepository) {}

  execute(ruleId: string): Promise<void> {
    if (!isUuid(ruleId)) throw new AppError('validation', 'rule id must be a UUID');
    return this.repository.validateRule(ruleId.trim());
  }
}

/** Every draft rule and reference range, for whoever validates or administers the knowledge. */
export class ListDrafts {
  constructor(private readonly repository: KnowledgeRepository) {}

  async execute(): Promise<Draft[]> {
    const [analytes, rules] = await Promise.all([
      this.repository.listAnalytes(),
      this.repository.listRuleDrafts(),
    ]);
    const perAnalyte = await Promise.all(
      analytes.map(async (analyte) => ({
        analyte,
        drafts: await this.repository.listReferenceDrafts(analyte.id),
      })),
    );
    return [
      ...rules.map((r): Draft => ({
        kind: 'rule',
        id: r.id,
        label: r.name ? `${r.code} v${r.version} · ${r.name}` : `${r.code} v${r.version}`,
        state: 'BORRADOR',
      })),
      ...perAnalyte.flatMap(({ analyte, drafts }) =>
        drafts.map((d): Draft => ({
          kind: 'reference',
          id: d.id,
          label: `${analyte.name} v${d.version} · ${rangeLabel(d.min, d.max, d.unit)}`,
          state: 'BORRADOR',
        })),
      ),
    ];
  }
}

/** The counts behind the administrator's summary: analytes, and validated against draft ranges and rules. */
export class GetKnowledgeSummary {
  constructor(private readonly repository: KnowledgeRepository) {}

  /** Rules are only asked for when the caller may see them (`withRules`); otherwise they count as zero. */
  async execute(withRules = true): Promise<KnowledgeSummary> {
    const [analytes, ruleDrafts, rulesValidated, referencesValidated] = await Promise.all([
      this.repository.listAnalytes(),
      withRules ? this.repository.listRuleDrafts() : Promise.resolve([]),
      withRules ? this.repository.countValidatedRules() : Promise.resolve(0),
      this.repository.countValidatedReferences(),
    ]);
    // The API only lists draft ranges one analyte at a time.
    const perAnalyte = await Promise.all(
      analytes.map((analyte) => this.repository.listReferenceDrafts(analyte.id)),
    );
    return {
      analytes: analytes.length,
      referencesValidated,
      referencesDraft: perAnalyte.reduce((total, drafts) => total + drafts.length, 0),
      rulesValidated,
      rulesDraft: ruleDrafts.length,
    };
  }
}

function rangeLabel(min: number | null, max: number | null, unit: string): string {
  if (min === null && max === null) return unit;
  if (min === null) return `< ${max} ${unit}`;
  if (max === null) return `> ${min} ${unit}`;
  return `${min} – ${max} ${unit}`;
}
