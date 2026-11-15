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
