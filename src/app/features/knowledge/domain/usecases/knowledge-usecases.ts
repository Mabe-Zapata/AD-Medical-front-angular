import { AppError } from '../../../../core/domain/app-error';
import { isUuid } from '../../../../core/domain/dates';
import { Analyte, NewAnalyte, NewReference, NewRule, ReferenceRange } from '../entities/knowledge';
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
