import { Criterion, NUMERIC_OPERATORS, NewReference, NewRule } from '../entities/knowledge';

export type ReferenceProblem = 'range_inverted' | 'age_inverted' | 'dates_inverted';
export type RuleProblem = 'no_criteria' | 'numeric_without_threshold' | 'numeric_without_unit';

export function isNumericOperator(operator: string): boolean {
  return (NUMERIC_OPERATORS as readonly string[]).includes(operator);
}

/** Cheap checks that spare a round trip; the backend remains the authority. */
export function referenceProblems(reference: NewReference): ReferenceProblem[] {
  const problems: ReferenceProblem[] = [];
  if (reference.min !== null && reference.max !== null && reference.min > reference.max) {
    problems.push('range_inverted');
  }
  if (
    reference.minAgeDays !== null &&
    reference.maxAgeDays !== null &&
    reference.minAgeDays > reference.maxAgeDays
  ) {
    problems.push('age_inverted');
  }
  // ISO dates compare correctly as strings.
  if (reference.endDate !== null && reference.endDate < reference.startDate) {
    problems.push('dates_inverted');
  }
  return problems;
}

/** Status operators (outside / inside the reference range) take no threshold: drop it. */
export function normalizeCriterion(criterion: Criterion): Criterion {
  return isNumericOperator(criterion.operator)
    ? criterion
    : { ...criterion, threshold: null, unit: null };
}

export function ruleProblems(rule: NewRule): RuleProblem[] {
  if (rule.criteria.length === 0) return ['no_criteria'];
  const problems = new Set<RuleProblem>();
  for (const criterion of rule.criteria) {
    if (!isNumericOperator(criterion.operator)) continue;
    if (criterion.threshold === null) problems.add('numeric_without_threshold');
    if (!criterion.unit) problems.add('numeric_without_unit');
  }
  return [...problems];
}
