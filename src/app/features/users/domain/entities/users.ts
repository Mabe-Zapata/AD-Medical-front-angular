// The staff accounts of the backend (usuarios, usuarios_roles). Field names are English; the role codes
// (MEDICO, ...) are the backend's own.

export interface UserSummary {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly active: boolean;
  readonly roles: readonly string[];
}

export interface NewUser {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: readonly string[];
}

/** Roles an administrator can give. */
export const ASSIGNABLE_ROLES = ['MEDICO', 'LABORATORISTA', 'ADMINISTRADOR', 'PACIENTE'] as const;
