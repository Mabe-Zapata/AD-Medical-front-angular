/** Same limit as the backend: a summary covers at most one year. */
export const MAX_PERIOD_DAYS = 366;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Why a period cannot be asked for, or null when it can. The screen turns each code into a sentence. */
export type PeriodProblem = 'missing' | 'format' | 'order' | 'too-long';

export function periodProblem(from: string, to: string): PeriodProblem | null {
  if (!from || !to) return 'missing';
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return 'format';
  if (from > to) return 'order';
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  return days > MAX_PERIOD_DAYS ? 'too-long' : null;
}
