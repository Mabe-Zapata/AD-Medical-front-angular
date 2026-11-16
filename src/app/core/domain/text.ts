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
 * Sanitizes free text (e.g. notes, reasons): removes emojis and dangerous code characters.
 */
export function sanitizeFreeText(text: string): string {
  return stripEmoji(text).replace(/[<>{}[\]\\^~|`$]/g, '');
}

/**
 * Sanitizes identifier inputs (UUIDs or registration codes): keeps only alphanumeric and hyphens.
 */
export function sanitizeIdentifier(text: string): string {
  return stripEmoji(text).replace(/[^a-zA-Z0-9-]/g, '').trim();
}
