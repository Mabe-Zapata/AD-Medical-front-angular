import { AppError } from '../../../core/domain/app-error';
import {
  Analyte,
  NewAnalyte,
  NewReference,
  NewRule,
  ReferenceDraft,
  ReferenceRange,
  RuleDraft,
} from './entities/knowledge';
import {
  isNumericOperator,
  normalizeCriterion,
  referenceProblems,
  ruleProblems,
} from './policies/knowledge-policies';
import { KnowledgeRepository } from './ports/knowledge.repository';
import {
  CreateAnalyte,
  CreateReferenceDraft,
  CreateRuleDraft,
  ListAnalytes,
  ListDrafts,
  ValidateReference,
  ValidateRule,
} from './usecases/knowledge-usecases';

const UUID = '11111111-2222-4333-8444-555555555555';

class FakeRepository extends KnowledgeRepository {
  created: unknown[] = [];
  validated: string[] = [];
  analytes: Analyte[] = [];
  ruleDrafts: RuleDraft[] = [];
  referenceDrafts: Record<string, ReferenceDraft[]> = {};

  async listAnalytes(): Promise<Analyte[]> {
    return this.analytes;
  }
  async createAnalyte(analyte: NewAnalyte): Promise<string> {
    this.created.push(analyte);
    return UUID;
  }
  async listReferences(): Promise<ReferenceRange[]> {
    return [];
  }
  async createReference(_id: string, reference: NewReference): Promise<string> {
    this.created.push(reference);
    return UUID;
  }
  async validateReference(id: string): Promise<void> {
    this.validated.push(id);
  }
  async createRule(rule: NewRule): Promise<string> {
    this.created.push(rule);
    return UUID;
  }
  async validateRule(id: string): Promise<void> {
    this.validated.push(id);
  }
  async listRuleDrafts(): Promise<RuleDraft[]> {
    return this.ruleDrafts;
  }
  async listReferenceDrafts(analyteId: string): Promise<ReferenceDraft[]> {
    return this.referenceDrafts[analyteId] ?? [];
  }
}

const reference = (over: Partial<NewReference> = {}): NewReference => ({
  sourceId: UUID,
  unit: 'g/dL',
  min: 12,
  max: 16,
  sex: null,
  minAgeDays: null,
  maxAgeDays: null,
  method: null,
  sampleType: null,
  context: null,
  startDate: '2026-01-01',
  endDate: null,
  ...over,
});

const rule = (over: Partial<NewRule> = {}): NewRule => ({
  code: 'HB-BAJA',
  name: 'Hemoglobina baja',
  description: null,
  type: 'HALLAZGO',
  logic: 'TODOS',
  message: 'Hemoglobina por debajo del rango',
  priority: 'INFORMATIVA',
  criteria: [{ analyteId: UUID, operator: 'LT', threshold: 12, unit: 'g/dL' }],
  ...over,
});

describe('reference policy', () => {
  it('accepts a coherent range', () => {
    expect(referenceProblems(reference())).toEqual([]);
  });

  it('flags an inverted range, ages and dates', () => {
    const problems = referenceProblems(
      reference({ min: 20, max: 10, minAgeDays: 9, maxAgeDays: 1, endDate: '2025-12-31' }),
    );
    expect(problems).toEqual(['range_inverted', 'age_inverted', 'dates_inverted']);
  });

  it('allows open-ended ranges', () => {
    expect(referenceProblems(reference({ min: null, max: 5 }))).toEqual([]);
  });
});

describe('rule policy', () => {
  it('knows which operators are numeric', () => {
    expect(isNumericOperator('GE')).toBe(true);
    expect(isNumericOperator('FUERA_REFERENCIA')).toBe(false);
  });

  it('drops the threshold of status operators', () => {
    const cleaned = normalizeCriterion({
      analyteId: UUID,
      operator: 'FUERA_REFERENCIA',
      threshold: 5,
      unit: 'mg/dL',
    });
    expect(cleaned).toMatchObject({ threshold: null, unit: null });
  });

  it('requires a threshold and a unit for numeric operators', () => {
    const problems = ruleProblems(
      rule({ criteria: [{ analyteId: UUID, operator: 'GT', threshold: null, unit: null }] }),
    );
    expect(problems).toEqual(['numeric_without_threshold', 'numeric_without_unit']);
  });

  it('requires at least one criterion', () => {
    expect(ruleProblems(rule({ criteria: [] }))).toEqual(['no_criteria']);
  });
});

describe('knowledge use cases', () => {
  it('lists analytes sorted by name', async () => {
    const repo = new FakeRepository();
    repo.analytes = [
      { id: '2', name: 'Zinc', unit: null, valueType: 'NUMERICO' },
      { id: '1', name: 'Albúmina', unit: null, valueType: 'NUMERICO' },
    ];
    const names = (await new ListAnalytes(repo).execute()).map((a) => a.name);
    expect(names).toEqual(['Albúmina', 'Zinc']);
  });

  it('trims the analyte name and turns a blank unit into null', async () => {
    const repo = new FakeRepository();
    await new CreateAnalyte(repo).execute({
      name: '  Glucosa ',
      unit: '  ',
      valueType: 'NUMERICO',
    });
    expect(repo.created).toEqual([{ name: 'Glucosa', unit: null, valueType: 'NUMERICO' }]);
  });

  it('refuses a blank analyte name', () => {
    expect(() =>
      new CreateAnalyte(new FakeRepository()).execute({
        name: ' ',
        unit: null,
        valueType: 'TEXTO',
      }),
    ).toThrow(AppError);
  });

  it('refuses a reference draft with an invalid source or range, without calling the API', () => {
    const repo = new FakeRepository();
    const useCase = new CreateReferenceDraft(repo);
    expect(() => useCase.execute(UUID, reference({ sourceId: 'not-a-uuid' }))).toThrow(AppError);
    expect(() => useCase.execute(UUID, reference({ min: 9, max: 1 }))).toThrow(AppError);
    expect(repo.created).toEqual([]);
  });

  it('creates a valid reference draft', async () => {
    const repo = new FakeRepository();
    expect(await new CreateReferenceDraft(repo).execute(UUID, reference())).toBe(UUID);
  });

  it('normalizes criteria before creating a rule', async () => {
    const repo = new FakeRepository();
    await new CreateRuleDraft(repo).execute(
      rule({
        criteria: [{ analyteId: UUID, operator: 'DENTRO_REFERENCIA', threshold: 3, unit: 'x' }],
      }),
    );
    expect(repo.created[0]).toMatchObject({ criteria: [{ threshold: null, unit: null }] });
  });

  it('refuses an incomplete numeric rule', () => {
    expect(() =>
      new CreateRuleDraft(new FakeRepository()).execute(
        rule({ criteria: [{ analyteId: UUID, operator: 'LT', threshold: 1, unit: null }] }),
      ),
    ).toThrow(AppError);
  });

  it('validates by UUID only', async () => {
    const repo = new FakeRepository();
    await new ValidateReference(repo).execute(` ${UUID} `);
    await new ValidateRule(repo).execute(UUID);
    expect(repo.validated).toEqual([UUID, UUID]);
    expect(() => new ValidateReference(repo).execute('abc')).toThrow(AppError);
    expect(() => new ValidateRule(repo).execute('')).toThrow(AppError);
  });
});

describe('ListDrafts', () => {
  it('joins the draft rules and the draft ranges of every analyte, with readable labels', async () => {
    const repository = new FakeRepository();
    repository.analytes = [
      { id: 'a1', name: 'Hemoglobina', unit: 'g/dL', valueType: 'NUMERICO' },
      { id: 'a2', name: 'Glucosa', unit: 'mg/dL', valueType: 'NUMERICO' },
    ];
    repository.ruleDrafts = [{ id: 'r1', code: 'HB-BAJA', version: 2, name: 'Hemoglobina baja' }];
    repository.referenceDrafts = {
      a1: [{ id: 'f1', analyteId: 'a1', version: 1, unit: 'g/dL', min: 12, max: 16 }],
      a2: [{ id: 'f2', analyteId: 'a2', version: 1, unit: 'mg/dL', min: null, max: 100 }],
    };

    const drafts = await new ListDrafts(repository).execute();

    expect(drafts.map((d) => [d.kind, d.id, d.state])).toEqual([
      ['rule', 'r1', 'BORRADOR'],
      ['reference', 'f1', 'BORRADOR'],
      ['reference', 'f2', 'BORRADOR'],
    ]);
    expect(drafts[0].label).toBe('HB-BAJA v2 · Hemoglobina baja');
    expect(drafts[1].label).toBe('Hemoglobina v1 · 12 – 16 g/dL');
    expect(drafts[2].label).toBe('Glucosa v1 · < 100 mg/dL');
  });

  it('has nothing to show when there are no drafts', async () => {
    expect(await new ListDrafts(new FakeRepository()).execute()).toEqual([]);
  });
});
