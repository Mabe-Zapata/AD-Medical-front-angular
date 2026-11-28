const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200B-\u200D\u2060\uFEFF\uFE0E\uFE0F\u20E3\u{E0020}-\u{E007F}]/gu;

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
 * Account names (first/last): letters only, single spaces between words, no leading or double spaces.
 */
export function sanitizePersonName(text: string): string {
  return stripEmoji(text)
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ ]/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +/, '');
}

/** One or more words of letters, separated by single spaces, 1 to 100 characters. */
export function isValidPersonName(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+( [a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+)*$/.test(trimmed);
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
 * Sanitizes emails: keeps only characters an address can use (letters, digits, . _ % + - @).
 * Emojis, modifiers, zero-width characters and spaces never survive.
 */
export function sanitizeEmail(text: string): string {
  return text.replace(/[^A-Za-z0-9._%+\-@]/g, '');
}

/**
 * Validates email format and ensures no emojis.
 */
export function isValidEmail(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 255) return false;
  if (hasEmoji(text) || /\s/.test(trimmed)) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(trimmed);
}

/**
 * Sanitizes passwords: removes emojis.
 */
export function sanitizePassword(text: string): string {
  return stripEmoji(text);
}

/**
 * Sanitizes search terms (names, phones, registration codes, ids): whitelist of Latin letters
 * (with Spanish accents), digits, whitespace and the few separators those lookups use.
 */
export function sanitizeSearch(text: string): string {
  return stripEmoji(text).replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.,\-_@'/&]/g, '');
}

/** Rule and catalog codes (e.g. HEMO-SINT, GLUC_01): letters, digits, "-" and "_", no spaces. */
export function sanitizeCode(text: string): string {
  return text.replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * Sanitizes free text (notes, reasons): whitelist of Latin letters (with Spanish accents), digits,
 * whitespace and common punctuation. Anything else (emojis, ©, box-drawing, code symbols) is removed
 * before it reaches the value, so it is never stored or counted. Leading spaces are dropped too.
 */
export function sanitizeFreeText(text: string): string {
  return stripEmoji(text)
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.,;:!?¿¡()"'\-–_%/°+@#&*=]/g, '')
    .replace(/^\s+/, '');
}

/**
 * Sanitizes identifier inputs (UUIDs or registration codes): keeps only alphanumeric and hyphens.
 */
export function sanitizeIdentifier(text: string): string {
  return stripEmoji(text).replace(/[^a-zA-Z0-9-]/g, '').trim();
}

/** Result values: no spaces, no emojis or symbols; digits, letters and . , < > % + - / only. */
export function sanitizeResultValue(text: string): string {
  return text.replace(/[^A-Za-z0-9áéíóúÁÉÍÓÚñÑüÜ.,<>%+\-/]/g, '');
}

/** Measurement units: letters and "/" only (e.g. "mg/dL"). Mirrors the unit rule of the analyte form. */
export function sanitizeUnit(text: string): string {
  return text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ/]/g, '');
}

/**
 * Catalog labels (e.g. analyte names): clinical characters only, single spaces between words and
 * no leading spaces, so emojis removed while typing never leave visible gaps.
 */
export function sanitizeLabel(text: string): string {
  return sanitizeClinicalText(text).replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
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

