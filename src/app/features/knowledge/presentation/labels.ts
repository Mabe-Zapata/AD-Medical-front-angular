// Spanish copy for the backend's codes. The domain only knows the codes.

export const VALUE_TYPE_LABELS: Readonly<Record<string, string>> = {
  NUMERICO: 'Numérico',
  TEXTO: 'Texto',
  CODIFICADO: 'Codificado',
};

export const RULE_TYPE_LABELS: Readonly<Record<string, string>> = {
  HALLAZGO: 'Hallazgo',
  HIPOTESIS: 'Hipótesis',
  ALERTA: 'Alerta',
};

export const RULE_LOGIC_LABELS: Readonly<Record<string, string>> = {
  TODOS: 'Se cumplen todos los criterios',
  CUALQUIERA: 'Se cumple cualquiera de los criterios',
};

export const RULE_PRIORITY_LABELS: Readonly<Record<string, string>> = {
  INFORMATIVA: 'Informativa',
  REVISION_MEDICA: 'Revisión médica',
  URGENTE: 'Urgente',
};

export const OPERATOR_LABELS: Readonly<Record<string, string>> = {
  LT: 'menor que (<)',
  LE: 'menor o igual que (≤)',
  GT: 'mayor que (>)',
  GE: 'mayor o igual que (≥)',
  EQ: 'igual a (=)',
  FUERA_REFERENCIA: 'fuera del rango de referencia',
  DENTRO_REFERENCIA: 'dentro del rango de referencia',
};

export const REFERENCE_PROBLEM_LABELS: Readonly<Record<string, string>> = {
  range_inverted: 'El mínimo no puede ser mayor que el máximo.',
  age_inverted: 'La edad mínima no puede ser mayor que la máxima.',
  dates_inverted: 'La fecha de fin no puede ser anterior a la de inicio.',
};

export const RULE_PROBLEM_LABELS: Readonly<Record<string, string>> = {
  no_criteria: 'Agrega al menos un criterio.',
  no_analyte: 'Elige un analito en cada criterio.',
  numeric_without_threshold: 'Los criterios numéricos necesitan un umbral.',
  numeric_without_unit: 'Los criterios numéricos necesitan la unidad del umbral.',
};

export function labelOf(labels: Readonly<Record<string, string>>, code: string): string {
  return labels[code] ?? code;
}
