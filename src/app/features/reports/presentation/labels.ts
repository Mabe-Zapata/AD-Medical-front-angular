// Spanish names of the backend states. A state the screen does not know is shown as its code.

export const APPOINTMENT_STATES: Readonly<Record<string, string>> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
  NO_ASISTIO: 'No asistió',
};

export const LAB_ORDER_STATES: Readonly<Record<string, string>> = {
  SOLICITADA: 'Solicitada',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

export const PAYMENT_STATES: Readonly<Record<string, string>> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
};

export const TREATMENT_STATES: Readonly<Record<string, string>> = {
  ACTIVO: 'Activo',
  FINALIZADO: 'Finalizado',
  SUSPENDIDO: 'Suspendido',
};

export const DELIVERY_STATES: Readonly<Record<string, string>> = {
  PENDIENTE: 'Pendiente',
  ENTREGADO: 'Entregado',
  ERROR_TEMPORAL: 'Error temporal',
  ERROR_PERMANENTE: 'Error permanente',
};

export function stateLabel(names: Readonly<Record<string, string>>, code: string): string {
  return names[code] ?? code;
}
