import { environment } from '../../../environments/environment';

/**
 * The schema stores UTC; branches use America/Guayaquil (UTC-5, no DST).
 * Parity with frontend-flutter/lib/core/time/branch_time.dart.
 */
export const BRANCH_UTC_OFFSET_HOURS = environment.branchUtcOffsetHours ?? -5;
export const BRANCH_UTC_OFFSET_MS = BRANCH_UTC_OFFSET_HOURS * 60 * 60 * 1000;

export interface BranchDateTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** ISO weekday: 1 = Monday, 7 = Sunday */
  readonly weekday: number;
}

const DAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

export function parseUtcMillis(utc: string | Date | number): number {
  if (typeof utc === 'number') {
    return utc;
  }
  if (utc instanceof Date) {
    return utc.getTime();
  }
  const raw = utc.trim();
  // If string has no timezone indicator, treat as UTC by appending 'Z'
  const isZoned = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = isZoned ? raw : `${raw}Z`;
  return new Date(normalized).getTime();
}

/** Returns true if the given UTC instant has already passed. */
export function isPastUtc(utc: string | Date | number, nowMillis = Date.now()): boolean {
  return parseUtcMillis(utc) < nowMillis;
}

/** Convert a UTC instant to branch wall-clock components (UTC-5). */
export function toBranchTime(utc: string | Date | number): BranchDateTime {
  const millis = parseUtcMillis(utc);
  const branchDate = new Date(millis + BRANCH_UTC_OFFSET_MS);
  const dayOfWeek = branchDate.getUTCDay();
  const weekday = dayOfWeek === 0 ? 7 : dayOfWeek;
  return {
    year: branchDate.getUTCFullYear(),
    month: branchDate.getUTCMonth() + 1,
    day: branchDate.getUTCDate(),
    hour: branchDate.getUTCHours(),
    minute: branchDate.getUTCMinutes(),
    weekday,
  };
}

/** `HH:mm` in branch time, e.g. "08:30". */
export function formatBranchTime(utc: string | Date | number): string {
  const bt = toBranchTime(utc);
  const hh = String(bt.hour).padStart(2, '0');
  const mm = String(bt.minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Spanish short date, e.g. "lun 2 nov 2026" or "lun 2 nov". */
export function formatBranchDate(utc: string | Date | number, includeYear = true): string {
  const bt = toBranchTime(utc);
  const dayName = DAYS[bt.weekday - 1];
  const monthName = MONTHS[bt.month - 1];
  return includeYear ? `${dayName} ${bt.day} ${monthName} ${bt.year}` : `${dayName} ${bt.day} ${monthName}`;
}

/** "08:30 – 09:00" in branch time. */
export function formatBranchTimeRange(startUtc: string | Date | number, endUtc: string | Date | number): string {
  return `${formatBranchTime(startUtc)} – ${formatBranchTime(endUtc)}`;
}
