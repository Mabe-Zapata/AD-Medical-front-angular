/** A consultorio (room) inside a sede. */
export interface Consultorio {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

/** A sede (branch) with its consultorios. Every sede uses the single clinic timezone (UTC-5). */
export interface Sede {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly active: boolean;
  readonly offices: readonly Consultorio[];
}

export interface NewSede {
  readonly name: string;
  readonly address: string | null;
}

/** Only the fields present change. A `null` address clears it. */
export interface SedeChanges {
  readonly name?: string;
  readonly address?: string | null;
  readonly active?: boolean;
}

/** Only the fields present change. */
export interface OfficeChanges {
  readonly name?: string;
  readonly active?: boolean;
}
