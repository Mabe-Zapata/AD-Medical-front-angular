import { describe, expect, it } from 'vitest';

import {
  OFFICE_NAME_MAX,
  SEDE_ADDRESS_MAX,
  SEDE_NAME_MAX,
  addressProblem,
  nameProblem,
  sedeDraftProblems,
} from './sede-policies';

describe('sede policies', () => {
  it('accepts a name at the limit and refuses one character more', () => {
    expect(nameProblem('a'.repeat(SEDE_NAME_MAX), SEDE_NAME_MAX)).toBeNull();
    expect(nameProblem('a'.repeat(SEDE_NAME_MAX + 1), SEDE_NAME_MAX)).toBe('tooLong');
  });

  it('counts an emoji as two units, the same way SQL Server counts nvarchar', () => {
    const emoji = '\u{1F600}';
    expect(nameProblem(emoji.repeat(40), OFFICE_NAME_MAX)).toBeNull();
    expect(nameProblem(emoji.repeat(41), OFFICE_NAME_MAX)).toBe('tooLong');
  });

  it('treats a blank name as required, after trimming', () => {
    expect(nameProblem('   \t  ', SEDE_NAME_MAX)).toBe('required');
  });

  it('refuses control characters such as NUL, newline and escape', () => {
    for (const value of ['Sede\u0000', 'Sede\nNueva', 'Sede\u001b[2J', 'Sede\u007f']) {
      expect(nameProblem(value, SEDE_NAME_MAX)).toBe('controlCharacters');
    }
  });

  it('allows an empty address, and refuses one over the limit', () => {
    expect(addressProblem('')).toBeNull();
    expect(addressProblem('   ')).toBeNull();
    expect(addressProblem('d'.repeat(SEDE_ADDRESS_MAX))).toBeNull();
    expect(addressProblem('d'.repeat(SEDE_ADDRESS_MAX + 1))).toBe('tooLong');
  });

  it('reports each field of a draft on its own', () => {
    expect(sedeDraftProblems({ name: '', address: 'ok' })).toEqual({ name: 'required', address: null });
    expect(sedeDraftProblems({ name: 'Sede', address: 'x\ny' })).toEqual({
      name: null,
      address: 'controlCharacters',
    });
  });

  it('keeps injection-looking text as plain text, with no special handling', () => {
    expect(nameProblem("Sede'); DROP TABLE sedes; --", SEDE_NAME_MAX)).toBeNull();
    expect(nameProblem('<script>alert(1)</script>', SEDE_NAME_MAX)).toBeNull();
  });
});
