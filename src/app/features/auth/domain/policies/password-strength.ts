/** Same minimum as the backend: a staff password needs at least this many characters. */
export const MIN_PASSWORD_LENGTH = 12;

export interface PasswordRequirement {
  readonly label: string;
  readonly met: (password: string) => boolean;
}

/** The rules a new staff password must follow, the same ones the backend checks. */
export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  { label: `Al menos ${MIN_PASSWORD_LENGTH} caracteres`, met: (p) => p.length >= MIN_PASSWORD_LENGTH },
  { label: 'Una mayúscula', met: (p) => /[A-Z]/.test(p) },
  { label: 'Una minúscula', met: (p) => /[a-z]/.test(p) },
  { label: 'Un número', met: (p) => /[0-9]/.test(p) },
  { label: 'Un símbolo', met: (p) => /[!-\/:-@\[-`{-~]/.test(p) },
];

/** Only the requirements the password does not meet yet, in the order they are listed. */
export function missingPasswordRequirements(password: string): string[] {
  return PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.met(password)).map((requirement) => requirement.label);
}

export interface PasswordStrength {
  readonly label: 'Débil' | 'Media' | 'Fuerte';
  readonly tone: 'weak' | 'medium' | 'strong';
  readonly percent: number;
}

/** The level follows how many requirements the password meets: all of them is strong, three or four is medium. */
export function passwordStrength(password: string): PasswordStrength {
  const total = PASSWORD_REQUIREMENTS.length;
  const met = PASSWORD_REQUIREMENTS.filter((requirement) => requirement.met(password)).length;
  const percent = Math.round((met / total) * 100);
  if (met === total) return { label: 'Fuerte', tone: 'strong', percent };
  if (met >= 3) return { label: 'Media', tone: 'medium', percent };
  return { label: 'Débil', tone: 'weak', percent };
}
