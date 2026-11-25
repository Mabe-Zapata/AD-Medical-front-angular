/**
 * Rules for sedes and consultorios, mirrored from the backend (`office_admin.py`) so the form can
 * explain a problem before a round trip. The backend decides; these only save the person a trip.
 *
 * Lengths are JavaScript string lengths, which count UTF-16 code units, the same unit SQL Server
 * uses for nvarchar. An emoji therefore takes two units in both places.
 */
export const SEDE_NAME_MAX = 150;
export const SEDE_ADDRESS_MAX = 300;
export const OFFICE_NAME_MAX = 80;

/** A problem with one field, as a stable reason the screen turns into Spanish copy. */
export type FieldProblem = 'required' | 'tooLong' | 'controlCharacters';

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/**
 * What the person may type in a sede, consultorio or address: Latin letters (with accents), digits and
 * the space. Nothing else: no punctuation, no symbols (ª, º, @, #, ...), no emojis, no tabs or control
 * characters. Dropped while typing, so it never reaches the value. Leading spaces are dropped;
 * repeated spaces collapse.
 */
export function sanitizeSedeText(text: string): string {
  return text
    .replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü0-9 ]/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +/, '');
}

/** Trims first: surrounding tabs and newlines are not content. */
export function cleanText(value: string): string {
  return value.trim();
}

export function nameProblem(value: string, max: number): FieldProblem | null {
  const text = cleanText(value);
  if (text.length === 0) return 'required';
  if (CONTROL_CHARACTERS.test(text)) return 'controlCharacters';
  if (text.length > max) return 'tooLong';
  return null;
}

export function addressProblem(value: string): FieldProblem | null {
  const text = cleanText(value);
  if (text.length === 0) return null; // an empty address is allowed and stored as null
  if (CONTROL_CHARACTERS.test(text)) return 'controlCharacters';
  if (text.length > SEDE_ADDRESS_MAX) return 'tooLong';
  return null;
}

export interface SedeDraftProblems {
  readonly name: FieldProblem | null;
  readonly address: FieldProblem | null;
}

export function sedeDraftProblems(draft: { name: string; address: string }): SedeDraftProblems {
  return {
    name: nameProblem(draft.name, SEDE_NAME_MAX),
    address: addressProblem(draft.address),
  };
}

/** True when any field of a problems object (e.g. SedeDraftProblems) has a reason. */
export function hasProblems(problems: object): boolean {
  return Object.values(problems).some((problem) => problem !== null);
}

/** The backend has a 409 with this code when a sede or consultorio still has future bookings. */
export const FUTURE_BOOKINGS_CODE = 'CITAS_FUTURAS';
/** Duplicate consultorio name inside one sede. */
export const DUPLICATE_OFFICE_CODE = 'CONSULTORIO_DUPLICADO';
/** Consultorio created or reactivated in an inactive sede. */
export const INACTIVE_SEDE_CODE = 'SEDE_INACTIVA';
