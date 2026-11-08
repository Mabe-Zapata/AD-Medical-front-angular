import { Decision, NewResult } from '../entities/orders';

/** Same limits as the API; checking here saves a round trip and gives a clearer message. */
export const MAX_REPORT_BYTES = 10 * 1024 * 1024;
export const MAX_RESULTS_PER_TEST = 50;
const MAX_UNIT = 40;
const MAX_TEXT_VALUE = 300;
const MAX_CONCLUSION = 4000;
const MAX_REASON = 2000;

const MAX_TESTS_PER_ORDER = 20;
const MAX_NOTES = 1000;

/** What is wrong with a new order. Empty means it can be sent. */
export function orderProblems(
  patientId: string,
  testTypeIds: readonly string[],
  notes: string,
): string[] {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const problems: string[] = [];
  if (!uuid.test(patientId.trim())) problems.push('the patient id must be a UUID');
  if (testTypeIds.length === 0) problems.push('at least one test is required');
  if (testTypeIds.length > MAX_TESTS_PER_ORDER) problems.push('too many tests');
  if (testTypeIds.some((id) => !uuid.test(id))) problems.push('every test id must be a UUID');
  if (notes.length > MAX_NOTES) problems.push('the notes are too long');
  return problems;
}

/** What is wrong with the results of one test. Empty means they can be sent. */
export function resultProblems(results: readonly NewResult[]): string[] {
  const problems: string[] = [];
  if (results.length === 0) problems.push('at least one result is required');
  if (results.length > MAX_RESULTS_PER_TEST) problems.push('too many results');
  for (const [index, result] of results.entries()) {
    const row = `result ${index + 1}`;
    if (!result.analyteName.trim()) problems.push(`${row}: analyte is required`);
    if (result.numericValue === null && !result.textValue?.trim()) {
      problems.push(`${row}: a value is required`);
    }
    if (result.numericValue !== null && !Number.isFinite(result.numericValue)) {
      problems.push(`${row}: the value is not a number`);
    }
    if ((result.unit?.length ?? 0) > MAX_UNIT) problems.push(`${row}: unit is too long`);
    if ((result.textValue?.length ?? 0) > MAX_TEXT_VALUE) problems.push(`${row}: text is too long`);
  }
  return problems;
}

/** The report must be a PDF no larger than the API accepts. */
export function reportProblems(file: { type: string; size: number; name: string }): string[] {
  const problems: string[] = [];
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) problems.push('the file is not a PDF');
  if (file.size === 0) problems.push('the file is empty');
  if (file.size > MAX_REPORT_BYTES) problems.push('the file is larger than 10 MB');
  return problems;
}

/** `CORREGIR` needs the corrected conclusion and `RECHAZAR` the reason; `ACEPTAR` needs nothing. */
export function decisionProblems(decision: Decision, text: string): string[] {
  const clean = text.trim();
  if (decision === 'CORREGIR' && !clean) return ['the corrected conclusion is required'];
  if (decision === 'RECHAZAR' && !clean) return ['the reason is required'];
  if (decision === 'CORREGIR' && clean.length > MAX_CONCLUSION)
    return ['the conclusion is too long'];
  if (decision === 'RECHAZAR' && clean.length > MAX_REASON) return ['the reason is too long'];
  return [];
}

export function reviewProblems(conclusion: string, recommendations: string): string[] {
  const problems: string[] = [];
  if (!conclusion.trim()) problems.push('the conclusion is required');
  if (conclusion.length > MAX_CONCLUSION) problems.push('the conclusion is too long');
  if (recommendations.length > MAX_CONCLUSION) problems.push('the recommendations are too long');
  return problems;
}
