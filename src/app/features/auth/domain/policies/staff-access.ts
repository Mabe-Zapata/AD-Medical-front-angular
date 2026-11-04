/** Roles that belong in this application. Patients use the Flutter portal instead. */
export const STAFF_ROLES: readonly string[] = ['MEDICO', 'LABORATORISTA', 'ADMINISTRADOR'];

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  PACIENTE: 'Paciente',
  MEDICO: 'Médico',
  LABORATORISTA: 'Laboratorista',
  ADMINISTRADOR: 'Administrador',
};

/** Permission codes seeded by the backend migrations. */
export const PERMISSIONS = {
  knowledgeRead: 'conocimiento.leer',
  knowledgeAdmin: 'conocimiento.administrar',
  knowledgeValidate: 'conocimiento.validar',
  usersAdmin: 'usuarios.administrar',
  ordersCreate: 'ordenes.crear',
  resultsRecord: 'resultados.registrar',
  resultsReadWithAccess: 'resultados.leer_con_acceso',
  reviewsRecord: 'revisiones.registrar',
} as const;

export function isStaff(roles: readonly string[]): boolean {
  return roles.some((role) => STAFF_ROLES.includes(role));
}
