/** `2026-11-03` becomes `03/11/2026`. Anything else is returned untouched. */
export function formatDate(iso: string | null): string {
  if (iso === null) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/**
 * Initials for an avatar: `Ana Pérez` is `AP`. An email uses its part before the `@`
 * (`ana.perez@lab.test` is `AP`); a single word gives its first two letters (`admin1@…` is `AD`).
 */
export function initialsOf(text: string): string {
  const base = text.includes('@') ? text.split('@')[0] : text;
  const words = base.split(/[^\p{L}]+/u).filter((word) => word.length > 0);
  if (words.length === 0) return '?';
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
}

export function formatRange(min: number | null, max: number | null, unit: string | null): string {
  const suffix = unit ? ` ${unit}` : '';
  if (min === null && max === null) return '—';
  if (min === null) return `< ${max}${suffix}`;
  if (max === null) return `> ${min}${suffix}`;
  return `${min} – ${max}${suffix}`;
}
