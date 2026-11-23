import { DAY_NAMES, WorkBlock } from '../entities/work-hours';

/** Clinic opening hours and the rules the backend also enforces; the form checks them before sending. */
export const CLINIC_OPENS = '08:00';
export const CLINIC_CLOSES = '17:00';
export const STEP_MINUTES = 15;
export const MAX_BLOCKS_PER_DAY = 4;
export const MAX_WEEKS_AHEAD = 12;

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Every 15-minute mark from the opening to the closing hour, as 'HH:MM'. */
export function timeOptions(): string[] {
  const options: string[] = [];
  for (let minute = toMinutes(CLINIC_OPENS); minute <= toMinutes(CLINIC_CLOSES); minute += STEP_MINUTES) {
    options.push(toClock(minute));
  }
  return options;
}

/** The first problem with a weekly schedule, in Spanish, or null when it can be saved. */
export function scheduleProblem(blocks: readonly WorkBlock[]): string | null {
  const perDay = new Map<number, WorkBlock[]>();
  for (const block of blocks) {
    if (toMinutes(block.start) >= toMinutes(block.end)) {
      return 'Cada bloque debe terminar después de que empieza.';
    }
    if (toMinutes(block.start) < toMinutes(CLINIC_OPENS) || toMinutes(block.end) > toMinutes(CLINIC_CLOSES)) {
      return `El horario debe estar entre ${CLINIC_OPENS} y ${CLINIC_CLOSES}.`;
    }
    if (toMinutes(block.start) % STEP_MINUTES !== 0 || toMinutes(block.end) % STEP_MINUTES !== 0) {
      return 'Los bloques empiezan y terminan en intervalos de 15 minutos.';
    }
    perDay.set(block.dayOfWeek, [...(perDay.get(block.dayOfWeek) ?? []), block]);
  }
  for (const [day, dayBlocks] of perDay) {
    if (dayBlocks.length > MAX_BLOCKS_PER_DAY) {
      return `Cada día admite como máximo ${MAX_BLOCKS_PER_DAY} bloques.`;
    }
    const ordered = [...dayBlocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let index = 1; index < ordered.length; index++) {
      if (toMinutes(ordered[index].start) < toMinutes(ordered[index - 1].end)) {
        return `Los bloques de ${DAY_NAMES[day] ?? 'ese día'} no pueden solaparse.`;
      }
    }
  }
  return null;
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday on or before `date`, as YYYY-MM-DD, in local time (the day the user sees). */
export function mondayOf(date: Date): string {
  const day = startOfDay(date);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return toIsoDate(day);
}

/** The Monday after `today`: where a change to the hours starts to apply. */
export function nextMonday(today: Date): string {
  const day = startOfDay(today);
  day.setDate(day.getDate() + (7 - ((day.getDay() + 6) % 7)));
  return toIsoDate(day);
}

export function isMonday(isoDate: string): boolean {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).getDay() === 1;
}

/** Null when a week can be planned; otherwise why not. Weeks start on Monday, are not over, and are near. */
export function weekProblem(isoDate: string, today: Date = new Date()): string | null {
  if (!isMonday(isoDate)) return 'Elige un lunes para empezar la semana.';
  if (isoDate < mondayOf(today)) return 'Esa semana ya pasó.';
  const limit = startOfDay(today);
  limit.setDate(limit.getDate() + MAX_WEEKS_AHEAD * 7);
  if (isoDate > toIsoDate(limit)) return `Solo se planea hasta ${MAX_WEEKS_AHEAD} semanas adelante.`;
  return null;
}
