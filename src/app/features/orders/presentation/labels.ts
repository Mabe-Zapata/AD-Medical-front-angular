// Spanish wording of the backend's codes. Unknown codes are shown as they come.

export const ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  SOLICITADA: 'Solicitada',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

export const TEST_STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADO: 'Completada',
  CANCELADO: 'Cancelada',
};

export const PRIORITY_LABELS: Readonly<Record<string, string>> = {
  NORMAL: 'Normal',
  URGENTE: 'Urgente',
};

export const PROPOSAL_STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDIENTE: 'Pendiente de decisión',
  ACEPTADA: 'Aceptada',
  CORREGIDA: 'Corregida',
  RECHAZADA: 'Rechazada',
  SIN_EVIDENCIA: 'Sin evidencia',
};

export const DECISION_LABELS: Readonly<Record<string, string>> = {
  ACEPTAR: 'Aceptar la propuesta',
  CORREGIR: 'Corregir la conclusión',
  RECHAZAR: 'Rechazar la propuesta',
};

export const FINDING_TYPE_LABELS: Readonly<Record<string, string>> = {
  HALLAZGO: 'Hallazgo',
  HIPOTESIS: 'Hipótesis',
  ALERTA: 'Alerta',
};

export const label = (labels: Readonly<Record<string, string>>, code: string): string =>
  labels[code] ?? code;
