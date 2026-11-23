import { describe, expect, it } from 'vitest';

import { WorkBlock } from '../entities/work-hours';
import {
  mondayOf,
  nextMonday,
  scheduleProblem,
  timeOptions,
  weekProblem,
} from './work-hours-policy';

const block = (dayOfWeek: number, start: string, end: string): WorkBlock => ({ dayOfWeek, start, end });

describe('scheduleProblem', () => {
  it('accepts a week inside the opening hours', () => {
    expect(scheduleProblem([block(0, '08:00', '10:00'), block(0, '12:00', '17:00')])).toBeNull();
  });

  it('refuses a block that does not end after it starts', () => {
    expect(scheduleProblem([block(0, '10:00', '09:00')])).toMatch(/terminar después/);
  });

  it('refuses hours outside the clinic', () => {
    expect(scheduleProblem([block(0, '07:30', '09:00')])).toMatch(/entre 08:00 y 17:00/);
    expect(scheduleProblem([block(0, '16:00', '17:30')])).toMatch(/entre 08:00 y 17:00/);
  });

  it('refuses times that are not on a 15-minute step', () => {
    expect(scheduleProblem([block(0, '08:05', '09:00')])).toMatch(/15 minutos/);
  });

  it('refuses overlapping blocks of the same day, but not of different days', () => {
    expect(scheduleProblem([block(0, '08:00', '10:00'), block(0, '09:30', '11:00')])).toMatch(/solapar/);
    expect(scheduleProblem([block(0, '08:00', '10:00'), block(1, '09:00', '11:00')])).toBeNull();
  });

  it('refuses more than four blocks in one day', () => {
    const five = [
      block(2, '08:00', '09:00'),
      block(2, '09:00', '10:00'),
      block(2, '12:00', '13:00'),
      block(2, '13:00', '14:00'),
      block(2, '14:00', '15:00'),
    ];
    expect(scheduleProblem(five)).toMatch(/máximo 4/);
  });

  it('accepts an empty week, meaning no hours from then on', () => {
    expect(scheduleProblem([])).toBeNull();
  });
});

describe('timeOptions', () => {
  it('offers every quarter hour from opening to closing', () => {
    const options = timeOptions();

    expect(options[0]).toBe('08:00');
    expect(options.at(-1)).toBe('17:00');
    expect(options).toHaveLength(37);
  });
});

describe('week helpers', () => {
  it('finds the Monday of a date, and the Monday after it', () => {
    const wednesday = new Date(2026, 10, 25); // 25 November 2026, a Wednesday

    expect(mondayOf(wednesday)).toBe('2026-11-23');
    expect(nextMonday(wednesday)).toBe('2026-11-30');
  });

  it('a change made on a Monday starts the Monday after, not that day', () => {
    expect(nextMonday(new Date(2026, 10, 23))).toBe('2026-11-30');
  });

  it('only plans Mondays that are not over and not too far ahead', () => {
    const today = new Date(2026, 10, 23);

    expect(weekProblem('2026-11-24', today)).toMatch(/lunes/);
    expect(weekProblem('2026-11-16', today)).toMatch(/ya pasó/);
    expect(weekProblem('2026-11-23', today)).toBeNull();
    expect(weekProblem('2027-06-07', today)).toMatch(/12 semanas/);
  });
});
