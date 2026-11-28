import { describe, expect, it } from 'vitest';

import {
  formatBranchDate,
  formatBranchTime,
  formatBranchTimeRange,
  isPastUtc,
  toBranchTime,
} from './branch-time';

describe('branch-time', () => {
  it('converts UTC instant to UTC-5 branch time components', () => {
    // 2026-11-02 13:30:00 UTC -> 2026-11-02 08:30:00 (Monday)
    const bt = toBranchTime('2026-11-02T13:30:00Z');
    expect(bt.year).toBe(2026);
    expect(bt.month).toBe(11);
    expect(bt.day).toBe(2);
    expect(bt.hour).toBe(8);
    expect(bt.minute).toBe(30);
    expect(bt.weekday).toBe(1); // Monday
  });

  it('handles day boundary when subtracting 5 hours', () => {
    // 2026-11-02 02:15:00 UTC -> 2026-11-01 21:15:00 (Sunday)
    const bt = toBranchTime('2026-11-02T02:15:00Z');
    expect(bt.year).toBe(2026);
    expect(bt.month).toBe(11);
    expect(bt.day).toBe(1);
    expect(bt.hour).toBe(21);
    expect(bt.minute).toBe(15);
    expect(bt.weekday).toBe(7); // Sunday
  });

  it('formats time in HH:mm branch time', () => {
    expect(formatBranchTime('2026-11-02T13:30:00Z')).toBe('08:30');
    expect(formatBranchTime('2026-11-02T05:05:00Z')).toBe('00:05');
  });

  it('formats dates in Spanish', () => {
    expect(formatBranchDate('2026-11-02T13:30:00Z', false)).toBe('lun 2 nov');
    expect(formatBranchDate('2026-11-02T13:30:00Z', true)).toBe('lun 2 nov 2026');
  });

  it('formats branch time ranges', () => {
    expect(formatBranchTimeRange('2026-11-02T13:30:00Z', '2026-11-02T14:00:00Z')).toBe('08:30 – 09:00');
  });

  it('checks whether an instant is in the past relative to a reference time', () => {
    const ref = new Date('2026-11-16T12:00:00Z').getTime();
    expect(isPastUtc('2026-11-16T11:00:00Z', ref)).toBe(true);
    expect(isPastUtc('2026-11-16T13:00:00Z', ref)).toBe(false);
  });
});
