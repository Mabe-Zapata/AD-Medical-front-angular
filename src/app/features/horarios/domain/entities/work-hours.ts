/** One block of work on a weekday: `start` and `end` are 'HH:MM' in branch time. */
export interface WorkBlock {
  /** 0 = Monday ... 6 = Sunday, as the backend numbers them. */
  readonly dayOfWeek: number;
  readonly start: string;
  readonly end: string;
}

/** The hours a doctor declared: this week's, and from next week on (the ones they edit). */
export interface DoctorHours {
  /** ISO date (YYYY-MM-DD) from which a change applies: the next Monday. */
  readonly effectiveFrom: string;
  readonly current: readonly WorkBlock[];
  readonly next: readonly WorkBlock[];
}

/** One-hour appointment slot the administrator can create. `window` says who it serves. */
export interface ProposedSlot {
  readonly startUtc: string;
  readonly endUtc: string;
  /** MANANA: sample collection (until 10:00). TARDE: consultations (from 12:00). */
  readonly window: 'MANANA' | 'TARDE';
}

export interface Consultorio {
  readonly id: string;
  readonly name: string;
  readonly office: string;
}

export interface DoctorOption {
  readonly id: string;
  readonly name: string;
}

export interface GenerationResult {
  readonly created: number;
  readonly existing: number;
}

export const DAY_NAMES: readonly string[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];
