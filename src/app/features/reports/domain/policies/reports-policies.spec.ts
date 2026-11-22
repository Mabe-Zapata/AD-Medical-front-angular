import { describe, expect, it } from 'vitest';

import { MAX_PERIOD_DAYS, periodProblem } from './reports-policies';

describe('periodProblem', () => {
  it('accepts a single day and a period of exactly the limit', () => {
    expect(periodProblem('2026-03-10', '2026-03-10')).toBeNull();
    expect(periodProblem('2026-01-01', '2026-12-31')).toBeNull();
  });

  it('flags a missing date', () => {
    expect(periodProblem('', '2026-03-10')).toBe('missing');
    expect(periodProblem('2026-03-01', '')).toBe('missing');
  });

  it('flags a date that is not ISO', () => {
    expect(periodProblem('10/03/2026', '2026-03-11')).toBe('format');
  });

  it('flags a period that ends before it starts', () => {
    expect(periodProblem('2026-03-11', '2026-03-10')).toBe('order');
  });

  it('flags a period one day longer than the limit', () => {
    expect(MAX_PERIOD_DAYS).toBe(366);
    // 2026-01-01 .. 2027-01-01 is 366 days inclusive: accepted. One more day is too long.
    expect(periodProblem('2026-01-01', '2027-01-01')).toBeNull();
    expect(periodProblem('2026-01-01', '2027-01-02')).toBe('too-long');
  });
});
