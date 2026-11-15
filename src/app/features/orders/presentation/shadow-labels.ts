// Spanish wording of the shadow findings' codes. Unknown codes are shown as they come.
import { label } from './labels';

export const SHADOW_FINDING_LABELS: Readonly<Record<string, string>> = {
  ANEMIA: 'Anemia',
  HIERRO: 'Hierro',
  DIABETES: 'Diabetes',
  MICROCITOSIS: 'Microcitosis (señal de apoyo)',
};

export const SHADOW_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  NO_EVALUABLE: 'No evaluable',
  DESCARTADO: 'Descartado por el médico',
  SIN_ANEMIA: 'Sin anemia',
  ANEMIA_LEVE: 'Anemia leve',
  ANEMIA_MODERADA: 'Anemia moderada',
  ANEMIA_GRAVE: 'Anemia grave',
  DEFICIENCIA_HIERRO: 'Deficiencia de hierro',
  SIN_DEFICIENCIA: 'Sin deficiencia de hierro',
  DEFICIENCIA_HIERRO_CON_INFLAMACION: 'Deficiencia de hierro con inflamación',
  SIN_DEFICIENCIA_CON_INFLAMACION: 'Sin deficiencia de hierro, con inflamación',
  DIABETES_CONFIRMADA: 'Diabetes confirmada',
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  PREDIABETES: 'Prediabetes',
  SIN_EVIDENCIA_DIABETES: 'Sin evidencia de diabetes',
  SENAL_MICROCITOSIS: 'Señal de microcitosis',
  SIN_SENAL: 'Sin señal',
};

export const SHADOW_ACTION_LABELS: Readonly<Record<string, string>> = {
  CONFIRMAR: 'Confirmar la sugerencia',
  DESCARTAR: 'Descartar el hallazgo',
  MODIFICAR: 'Modificar la categoría',
};

/** What each action records, in the past tense, for the history. */
export const SHADOW_ACTION_PAST: Readonly<Record<string, string>> = {
  CONFIRMAR: 'Confirmó',
  DESCARTAR: 'Descartó',
  MODIFICAR: 'Modificó',
};

export const EVIDENCE_ROLE_LABELS: Readonly<Record<string, string>> = {
  hemoglobina: 'Hemoglobina',
  ferritina: 'Ferritina',
  pcr: 'PCR',
  glucosa_ayuno: 'Glucosa en ayunas',
  hba1c: 'HbA1c',
};

export const findingLabel = (code: string) => label(SHADOW_FINDING_LABELS, code);
export const categoryLabel = (code: string) => label(SHADOW_CATEGORY_LABELS, code);
export const roleLabel = (code: string) => label(EVIDENCE_ROLE_LABELS, code);
