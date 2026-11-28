// Spanish copy for the clinical history. Every visible word of the feature lives here, so the
// pages never carry loose strings.
import type { AntecedentType, AllergySeverity, EntryKind, EntryOrigin } from '../domain/entities/historia';

export const KIND_LABEL: Readonly<Record<EntryKind, string>> = {
  allergy: 'Alergia',
  antecedent: 'Antecedente',
  medication: 'Medicación',
  problem: 'Problema activo',
  vaccine: 'Vacuna',
};

export const KIND_PLURAL: Readonly<Record<EntryKind, string>> = {
  allergy: 'Alergias',
  antecedent: 'Antecedentes',
  medication: 'Medicación',
  problem: 'Problemas activos',
  vaccine: 'Vacunas',
};

export const SEVERITY_LABEL: Readonly<Record<AllergySeverity, string>> = {
  LEVE: 'Leve',
  MODERADA: 'Moderada',
  GRAVE: 'Grave',
  DESCONOCIDA: 'Desconocida',
};

export const ANTECEDENT_TYPE_LABEL: Readonly<Record<AntecedentType, string>> = {
  PERSONAL: 'Personal',
  FAMILIAR: 'Familiar',
  QUIRURGICO: 'Quirúrgico',
};

export const STATE_LABEL: Readonly<Record<string, string>> = {
  ACTIVA: 'Activa',
  RESUELTA: 'Resuelta',
  ERRONEA: 'Errónea',
  ACTIVO: 'Activo',
  RESUELTO: 'Resuelto',
  ERRONEO: 'Errónea',
  SUSPENDIDA: 'Suspendida',
};

/** A plain sentence for the origin and verification of an entry: who said it, and whether it is confirmed. */
export function originLabel(origin: EntryOrigin, verified: boolean): string {
  if (origin === 'DOCTOR') return 'Registrada por el médico';
  return verified ? 'Declarada por el paciente · confirmada por el médico' : 'Declarada por el paciente · sin confirmar';
}

export const ACTION_LABEL: Readonly<Record<string, string>> = {
  CREAR: 'Registro nuevo',
  VERIFICAR: 'Confirmada por el médico',
  ESTADO: 'Cambio de estado',
  CORREGIR: 'Corrección de signos vitales',
};

export const ENTITY_LABEL: Readonly<Record<string, string>> = {
  alergia: 'Alergia',
  antecedente: 'Antecedente',
  medicacion: 'Medicación',
  problema: 'Problema',
  vacuna: 'Vacuna',
  signos_vitales: 'Signos vitales',
};

/** What a field refusal means to the person, keyed by the stable names the policies return. */
export const FIELD_PROBLEM: Readonly<Record<string, string>> = {
  substanceCode: 'Elige la sustancia de la lista.',
  severity: 'Elige la gravedad.',
  reaction: 'La reacción no puede pasar de 300 caracteres.',
  type: 'Elige el tipo de antecedente.',
  description: 'Escribe una descripción de hasta 500 caracteres (300 en problemas).',
  relative: 'Indica el familiar (hasta 50 caracteres).',
  name: 'Escribe el medicamento (hasta 150 caracteres).',
  dose: 'La dosis no puede pasar de 80 caracteres.',
  frequency: 'La frecuencia no puede pasar de 80 caracteres.',
  cie11: 'El código CIE-11 debe tener el formato de la lista, por ejemplo BA00.',
  vaccineCode: 'Elige la vacuna de la lista.',
  doseNumber: 'La dosis debe ser un número del 1 al 10.',
  date: 'Indica la fecha de la vacuna.',
  future: 'La fecha no puede ser futura.',
  lot: 'El lote no puede pasar de 40 caracteres.',
  motivo: 'Escribe el motivo (hasta 500 caracteres).',
  empty: 'Escribe al menos una medida.',
  order: 'La fecha final no puede ser anterior a la inicial.',
  span: 'El rango no puede pasar de un año.',
  peso_kg: 'El peso debe estar entre 0,5 y 300 kg.',
  weightKg: 'El peso debe estar entre 0,5 y 300 kg.',
  heightCm: 'La talla debe estar entre 30 y 250 cm.',
  systolic: 'La presión sistólica debe estar entre 50 y 260.',
  diastolic: 'La presión diastólica debe estar entre 30 y 160.',
  heartRate: 'La frecuencia cardiaca debe estar entre 20 y 250.',
  temperatureC: 'La temperatura debe estar entre 30 y 45 °C.',
  oxygen: 'La saturación debe estar entre 50 y 100.',
};

/** Field keys in a refusal, as one Spanish sentence. */
export function problemsSentence(problems: readonly string[]): string {
  const texts = [...new Set(problems.map((key) => FIELD_PROBLEM[key] ?? 'Revisa los datos.'))];
  return texts.join(' ');
}
