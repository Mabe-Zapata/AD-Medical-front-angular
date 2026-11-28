import { EditableFinding, NewShadowEdit } from '../entities/shadow';

/** Same limit as the API. */
export const MAX_SHADOW_REASON = 500;

/**
 * The categories a physician may choose when modifying a finding. They mirror the backend's allowed
 * values: the API is the authority, this only saves a round trip and gives a clearer message.
 */
export const SHADOW_CATEGORIES: Readonly<Record<EditableFinding, readonly string[]>> = {
  ANEMIA: ['SIN_ANEMIA', 'ANEMIA_LEVE', 'ANEMIA_MODERADA', 'ANEMIA_GRAVE'],
  HIERRO: [
    'DEFICIENCIA_HIERRO',
    'SIN_DEFICIENCIA',
    'DEFICIENCIA_HIERRO_CON_INFLAMACION',
    'SIN_DEFICIENCIA_CON_INFLAMACION',
  ],
  DIABETES: [
    'DIABETES_CONFIRMADA',
    'PENDIENTE_CONFIRMACION',
    'PREDIABETES',
    'SIN_EVIDENCIA_DIABETES',
  ],
};

/** What is wrong with a physician's edit. Empty means it can be sent. */
export function shadowEditProblems(
  finding: EditableFinding,
  currentCategory: string,
  edit: NewShadowEdit,
): string[] {
  const problems: string[] = [];
  const reason = edit.reason.trim();
  if (!reason) problems.push('a reason is required');
  if (reason.length > MAX_SHADOW_REASON) problems.push('the reason is too long');

  if (edit.action === 'MODIFICAR') {
    if (edit.newCategory === null) {
      problems.push('the new category is required');
    } else if (!SHADOW_CATEGORIES[finding].includes(edit.newCategory)) {
      problems.push('the category is not valid for this finding');
    } else if (edit.newCategory === currentCategory) {
      problems.push('the new category must differ from the suggestion');
    }
  } else if (edit.newCategory !== null) {
    problems.push('only a modification takes a category');
  }
  return problems;
}
