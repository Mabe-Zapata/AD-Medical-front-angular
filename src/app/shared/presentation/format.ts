/** `2026-11-03` becomes `03/11/2026`. Anything else is returned untouched. */
export function formatDate(iso: string | null): string {
  if (iso === null) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

export function formatRange(min: number | null, max: number | null, unit: string | null): string {
  const suffix = unit ? ` ${unit}` : '';
  if (min === null && max === null) return '—';
  if (min === null) return `< ${max}${suffix}`;
  if (max === null) return `> ${min}${suffix}`;
  return `${min} – ${max}${suffix}`;
}
