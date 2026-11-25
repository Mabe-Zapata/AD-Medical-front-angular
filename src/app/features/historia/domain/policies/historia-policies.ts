/**
 * Rules for the clinical history, mirrored from the backend (`history/domain/policies.py`) so a form can
 * explain a problem before a round trip. The backend decides; these only save the person a trip.
 *
 * Each validator returns the fields with a problem, as stable keys the screen turns into Spanish copy.
 */
import type {
  AllergySeverity,
  AntecedentType,
  DateRange,
  EntryKind,
  VitalMeasures,
} from '../entities/historia';

export const MOTIVO_MAX = 500;
export const MAX_RANGE_DAYS = 366;
export const DESCRIPTION_MAX = 500;
export const PROBLEM_MAX = 300;
export const REACTION_MAX = 300;
export const RELATIVE_MAX = 50;
export const NAME_MAX = 150;
export const DOSE_MAX = 80;
export const LOT_MAX = 40;

const CIE11 = /^[0-9A-Z]{1,4}(\.[0-9A-Z]{1,4})*$/;
const SEVERITIES: readonly AllergySeverity[] = ['LEVE', 'MODERADA', 'GRAVE', 'DESCONOCIDA'];
const ANTECEDENT_TYPES: readonly AntecedentType[] = ['PERSONAL', 'FAMILIAR', 'QUIRURGICO'];

/** Field keys with a problem. Empty means the input is valid. */
export type Problems = readonly string[];

const trimmed = (value: string | null | undefined): string => (value ?? '').trim();

export function validateRange(range: DateRange, today: string): Problems {
  const problems: string[] = [];
  if (range.from && range.to) {
    if (range.to < range.from) problems.push('order');
    else if (daysBetween(range.from, range.to) > MAX_RANGE_DAYS) problems.push('span');
  }
  if (range.from && range.from > today) problems.push('future');
  return problems;
}

export function validateMotivo(motivo: string | null | undefined): Problems {
  const text = trimmed(motivo);
  if (!text) return ['motivo'];
  return text.length > MOTIVO_MAX ? ['motivo'] : [];
}

export function validateCie11(code: string | null | undefined): Problems {
  const text = trimmed(code);
  if (!text) return [];
  return CIE11.test(text.toUpperCase()) ? [] : ['cie11'];
}

export function validateAllergy(input: {
  substanceCode: string;
  severity: string;
  reaction: string | null;
}): Problems {
  const problems: string[] = [];
  if (!trimmed(input.substanceCode)) problems.push('substanceCode');
  if (!SEVERITIES.includes(input.severity as AllergySeverity)) problems.push('severity');
  if (trimmed(input.reaction).length > REACTION_MAX) problems.push('reaction');
  return problems;
}

export function validateAntecedent(input: {
  type: string;
  description: string;
  relative: string | null;
  cie11: string | null;
}): Problems {
  const problems: string[] = [];
  if (!ANTECEDENT_TYPES.includes(input.type as AntecedentType)) problems.push('type');
  const description = trimmed(input.description);
  if (!description || description.length > DESCRIPTION_MAX) problems.push('description');
  const relative = trimmed(input.relative);
  if (input.type === 'FAMILIAR' && !relative) problems.push('relative');
  if (relative.length > RELATIVE_MAX) problems.push('relative');
  return [...problems, ...validateCie11(input.cie11)];
}

export function validateMedication(input: { name: string; dose: string | null; frequency: string | null }): Problems {
  const problems: string[] = [];
  const name = trimmed(input.name);
  if (!name || name.length > NAME_MAX) problems.push('name');
  if (trimmed(input.dose).length > DOSE_MAX) problems.push('dose');
  if (trimmed(input.frequency).length > DOSE_MAX) problems.push('frequency');
  return problems;
}

export function validateProblem(input: { description: string; cie11: string | null }): Problems {
  const description = trimmed(input.description);
  const problems: string[] = [];
  if (!description || description.length > PROBLEM_MAX) problems.push('description');
  return [...problems, ...validateCie11(input.cie11)];
}

export function validateVaccine(input: {
  vaccineCode: string;
  doseNumber: number;
  date: string;
  lot: string | null;
}, today: string): Problems {
  const problems: string[] = [];
  if (!trimmed(input.vaccineCode)) problems.push('vaccineCode');
  if (!Number.isInteger(input.doseNumber) || input.doseNumber < 1 || input.doseNumber > 10) problems.push('doseNumber');
  if (!input.date) problems.push('date');
  else if (input.date > today) problems.push('future');
  if (trimmed(input.lot).length > LOT_MAX) problems.push('lot');
  return problems;
}

/** Only the measures filled in are checked; at least one must be present. Ranges mirror the backend. */
export function validateVitals(measures: Partial<VitalMeasures>): Problems {
  const ranges: [keyof VitalMeasures, number, number][] = [
    ['weightKg', 0.5, 300],
    ['heightCm', 30, 250],
    ['systolic', 50, 260],
    ['diastolic', 30, 160],
    ['heartRate', 20, 250],
    ['temperatureC', 30, 45],
    ['oxygen', 50, 100],
  ];
  const filled = ranges.filter(([key]) => measures[key] !== null && measures[key] !== undefined);
  if (filled.length === 0) return ['empty'];
  return filled
    .filter(([key, low, high]) => {
      const value = measures[key] as number;
      return !Number.isFinite(value) || value < low || value > high;
    })
    .map(([key]) => key);
}

/** Today in the local calendar, as YYYY-MM-DD. */
export function localIsoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD), calendar arithmetic in UTC. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** The states an entry can move to from its current one, as the backend declares them. Erroneous is final. */
const NEXT_STATES: Readonly<Record<EntryKind, Readonly<Record<string, readonly string[]>>>> = {
  allergy: { ACTIVA: ['RESUELTA', 'ERRONEA'], RESUELTA: ['ACTIVA', 'ERRONEA'] },
  antecedent: { ACTIVO: ['RESUELTO', 'ERRONEO'], RESUELTO: ['ACTIVO', 'ERRONEO'] },
  medication: { ACTIVA: ['SUSPENDIDA', 'ERRONEA'], SUSPENDIDA: ['ACTIVA', 'ERRONEA'] },
  problem: { ACTIVO: ['RESUELTO', 'ERRONEO'], RESUELTO: ['ACTIVO', 'ERRONEO'] },
  vaccine: { ACTIVA: ['ERRONEA'] },
};

export function nextStates(kind: EntryKind, current: string | null): readonly string[] {
  return current === null ? [] : (NEXT_STATES[kind][current] ?? []);
}
