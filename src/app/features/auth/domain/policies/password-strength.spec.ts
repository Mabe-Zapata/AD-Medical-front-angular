import { missingPasswordRequirements, passwordStrength } from './password-strength';

describe('password policy', () => {
  it('lists only the requirements the password still misses', () => {
    expect(missingPasswordRequirements('Password_123')).toEqual([]);
    expect(missingPasswordRequirements('contraseña-segura-2026')).toEqual(['Una mayúscula']);
  });

  it('grades the level by how many requirements are met', () => {
    expect(passwordStrength('Password_123').label).toBe('Fuerte');
    expect(passwordStrength('Abcdefgh1234').label).toBe('Media');
    expect(passwordStrength('abc').label).toBe('Débil');
  });
});
