const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]/gu;

/** Removes emoji (and the joiners that glue them) from free text. */
export function stripEmoji(text: string): string {
  return text.replace(EMOJI, '');
}

export function hasEmoji(text: string): boolean {
  return stripEmoji(text) !== text;
}

/** Lower-case, accent-free form used to match what the person types against names. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Sanitizes person names (first/last names):
 * Strips emojis, digits, and special characters.
 * Retains only Latin letters (including Spanish accents á, é, í, ó, ú, ü, ñ), spaces, hyphens, and apostrophes.
 */
export function sanitizeName(text: string): string {
  return stripEmoji(text).replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]/g, '');
}

/**
 * Validates whether a person name contains only letters, spaces, hyphens, and apostrophes,
 * and no emojis or digits.
 */
export function isValidName(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  if (hasEmoji(text)) return false;
  return /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(trimmed);
}

/**
 * Sanitizes emails: removes emojis, whitespace, and illegal characters.
 */
export function sanitizeEmail(text: string): string {
  return stripEmoji(text).replace(/[\s<>{}()[\]\\\/^~|;:"',]/g, '');
}

/**
 * Validates email format and ensures no emojis.
 */
export function isValidEmail(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 255) return false;
  if (hasEmoji(text)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Sanitizes passwords: removes emojis.
 */
export function sanitizePassword(text: string): string {
  return stripEmoji(text);
}

/**
 * Sanitizes search terms: removes emojis and dangerous injection characters.
 */
export function sanitizeSearch(text: string): string {
  return stripEmoji(text).replace(/[<>{}[\]\\^~|;:"`$]/g, '');
}

/**
 * Sanitizes free text (notes, reasons): whitelist of Latin letters (with Spanish accents), digits,
 * whitespace and common punctuation. Anything else (emojis, ©, box-drawing, code symbols) is removed
 * before it reaches the value, so it is never stored or counted.
 */
export function sanitizeFreeText(text: string): string {
  return stripEmoji(text).replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.,;:!?¿¡()"'\-–_%/°+@#&*=]/g, '');
}

/**
 * Sanitizes identifier inputs (UUIDs or registration codes): keeps only alphanumeric and hyphens.
 */
export function sanitizeIdentifier(text: string): string {
  return stripEmoji(text).replace(/[^a-zA-Z0-9-]/g, '').trim();
}

/** Measurement units: letters and "/" only (e.g. "mg/dL"). Mirrors the unit rule of the analyte form. */
export function sanitizeUnit(text: string): string {
  return text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ/]/g, '');
}

/** Thresholds: digits with an optional "." or "," separator. Mirrors the decimal(18, 6) column. */
export function sanitizeThreshold(text: string): string {
  return text.replace(/[^0-9.,]/g, '');
}

/** Up to 12 integer digits and 6 decimals, the precision of the threshold column in the database. */
export function isValidThreshold(text: string): boolean {
  return /^\d{1,12}([.,]\d{1,6})?$/.test(text.trim());
}

export function parseThreshold(text: string): number {
  return Number(text.trim().replace(',', '.'));
}

/**
 * Clinical text (diagnoses, treatments): allows Latin letters with Spanish accents,
 * digits, whitespace, and clinical punctuation (.,:;()/-–%°'").
 * Strips emojis and special/code-injection symbols.
 */
export function sanitizeClinicalText(text: string): string {
  return stripEmoji(text).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,:;()/\-–%°'"]/g, '');
}

/**
 * Validates that clinical text has no emojis, respects the maximum length (default 1000),
 * and contains only allowed clinical characters.
 */
export function isValidClinicalText(text: string, maxLength = 1000): boolean {
  if (hasEmoji(text)) return false;
  if (text.length > maxLength) return false;
  return /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,:;()/\-–%°'"]*$/.test(text);
}

