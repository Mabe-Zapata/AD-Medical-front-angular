import { initialsOf } from './format';

describe('initialsOf', () => {
  it('takes the first letter of the first two words of a name', () => {
    expect(initialsOf('Ana Pérez Mora')).toBe('AP');
  });

  it('reads an email by its part before the @', () => {
    expect(initialsOf('ana.perez@lab.test')).toBe('AP');
  });

  it('gives the first two letters of a single word and ignores digits', () => {
    expect(initialsOf('admin1@synthetic.test')).toBe('AD');
  });

  it('never returns an empty avatar', () => {
    expect(initialsOf('123@lab.test')).toBe('?');
  });
});
