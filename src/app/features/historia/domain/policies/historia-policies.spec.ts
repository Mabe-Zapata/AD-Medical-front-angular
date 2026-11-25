import { describe, expect, it } from 'vitest';

import {
  daysBetween,
  validateAllergy,
  validateAntecedent,
  validateCie11,
  validateMotivo,
  validateProblem,
  validateRange,
  validateVaccine,
  validateVitals,
} from './historia-policies';

const TODAY = '2026-11-25';

describe('history date ranges', () => {
  it('accepts an open range and one that ends the same day it starts', () => {
    expect(validateRange({ from: null, to: null }, TODAY)).toEqual([]);
    expect(validateRange({ from: '2026-11-25', to: '2026-11-25' }, TODAY)).toEqual([]);
  });

  it('refuses a range that ends before it starts', () => {
    expect(validateRange({ from: '2026-11-25', to: '2026-11-01' }, TODAY)).toEqual(['order']);
  });

  it('refuses a range wider than 366 days, and accepts exactly 366', () => {
    expect(validateRange({ from: '2025-11-25', to: '2026-11-27' }, TODAY)).toEqual(['span']);
    expect(validateRange({ from: '2025-11-25', to: '2026-11-26' }, TODAY)).toEqual([]);
  });

  it('refuses a start date in the future', () => {
    expect(validateRange({ from: '2026-12-01', to: null }, TODAY)).toEqual(['future']);
  });

  it('counts whole calendar days across a leap year', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });
});

describe('history entries', () => {
  it('an allergy needs a catalog code and a known severity', () => {
    expect(validateAllergy({ substanceCode: 'PENICILINA', severity: 'GRAVE', reaction: null })).toEqual([]);
    expect(validateAllergy({ substanceCode: '', severity: 'GRAVE', reaction: null })).toEqual(['substanceCode']);
    expect(validateAllergy({ substanceCode: 'PENICILINA', severity: 'MUY_GRAVE', reaction: null })).toEqual(['severity']);
  });

  it('a family antecedent needs the relative, a personal one does not', () => {
    expect(validateAntecedent({ type: 'FAMILIAR', description: 'Diabetes', relative: null, cie11: null }))
      .toEqual(['relative']);
    expect(validateAntecedent({ type: 'PERSONAL', description: 'Asma', relative: null, cie11: null })).toEqual([]);
  });

  it('a problem needs a description of at most 300 characters', () => {
    expect(validateProblem({ description: 'x'.repeat(301), cie11: null })).toEqual(['description']);
    expect(validateProblem({ description: '   ', cie11: null })).toEqual(['description']);
  });

  it('a vaccine dose is a whole number from 1 to 10, and its date is not in the future', () => {
    const base = { vaccineCode: 'INFLUENZA', date: '2026-06-01', lot: null };
    expect(validateVaccine({ ...base, doseNumber: 1 }, TODAY)).toEqual([]);
    expect(validateVaccine({ ...base, doseNumber: 11 }, TODAY)).toEqual(['doseNumber']);
    expect(validateVaccine({ ...base, doseNumber: 1.5 }, TODAY)).toEqual(['doseNumber']);
    expect(validateVaccine({ ...base, doseNumber: 1, date: '2026-12-01' }, TODAY)).toEqual(['future']);
  });

  it('CIE-11 codes are checked by format, case-insensitively', () => {
    expect(validateCie11('ba00')).toEqual([]);
    expect(validateCie11('5A11.0')).toEqual([]);
    expect(validateCie11('BA 00')).toEqual(['cie11']);
    expect(validateCie11('')).toEqual([]);
  });

  it('a motivo is required and at most 500 characters', () => {
    expect(validateMotivo('  ')).toEqual(['motivo']);
    expect(validateMotivo('x'.repeat(501))).toEqual(['motivo']);
    expect(validateMotivo('Desensibilizada')).toEqual([]);
  });
});

describe('vital signs', () => {
  const none = {
    weightKg: null, heightCm: null, systolic: null, diastolic: null,
    heartRate: null, temperatureC: null, oxygen: null,
  };

  it('needs at least one measure', () => {
    expect(validateVitals(none)).toEqual(['empty']);
  });

  it('checks each measure against its clinical range, and accepts the limits', () => {
    expect(validateVitals({ ...none, weightKg: 0.5, oxygen: 100 })).toEqual([]);
    expect(validateVitals({ ...none, oxygen: 101 })).toEqual(['oxygen']);
    expect(validateVitals({ ...none, systolic: 49, diastolic: 80 })).toEqual(['systolic']);
  });
});
