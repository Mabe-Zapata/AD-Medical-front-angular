import { PERMISSIONS } from '../features/auth/domain/policies/staff-access';

/** One area of the staff system, and who may see it. */
export interface AppModule {
  readonly title: string;
  readonly description: string;
  /** Route of the module, or null while the area is not built yet. */
  readonly link: string | null;
  /** The module is visible to someone who holds at least one of these permissions. */
  readonly anyOf: readonly string[];
  /** Why a visible module cannot be opened yet. */
  readonly pendingNote: string | null;
}

export const APP_MODULES: readonly AppModule[] = [
  {
    title: 'Conocimiento clínico',
    description: 'Analitos, rangos de referencia y reglas del motor de propuestas.',
    link: '/conocimiento',
    anyOf: [PERMISSIONS.knowledgeRead],
    pendingNote: null,
  },
  {
    title: 'Órdenes y resultados',
    description: 'Registrar resultados, subir informes PDF y revisar propuestas.',
    link: '/ordenes',
    anyOf: [
      PERMISSIONS.ordersCreate,
      PERMISSIONS.resultsRecord,
      PERMISSIONS.resultsReadWithAccess,
      PERMISSIONS.reviewsRecord,
    ],
    pendingNote: null,
  },
  {
    title: 'Usuarios y roles',
    description: 'Crear cuentas del personal y de pacientes.',
    link: null,
    anyOf: [PERMISSIONS.usersAdmin],
    pendingNote: 'Próximamente',
  },
];

/**
 * Modules the signed-in person may see. What a role cannot use is not shown at all, not even as
 * "coming soon": the navigation must not hint at areas that belong to someone else.
 * The backend still decides every request; this only keeps the interface honest.
 */
export function visibleModules(can: (permission: string) => boolean): AppModule[] {
  return APP_MODULES.filter((module) => module.anyOf.some(can));
}
