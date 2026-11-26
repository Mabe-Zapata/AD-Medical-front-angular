import { AppError } from '../../../core/domain/app-error';
import { describeError } from '../../../shared/presentation/error-message';

/**
 * What the laboratory reads when an order cannot be confirmed. The backend names the reason with a
 * stable code (409), so the copy does not depend on the English detail.
 */
export function confirmFailureMessage(error: unknown): string {
  const code = error instanceof AppError ? error.code : undefined;
  if (code === 'LAB_REVIEW_PENDING') {
    return 'Revisa la interpretación de cada resultado antes de confirmar la orden.';
  }
  if (code === 'MEDICAL_REVIEW_PENDING') {
    return 'El médico debe revisar la orden y decidir sobre cada hallazgo antes de confirmarla.';
  }
  return describeError(error, {
    conflict: 'La orden ya está confirmada o cambió mientras la revisabas. Vuelve a cargarla.',
    not_found: 'No encontramos esa orden.',
    forbidden: 'No tienes permiso para confirmar esta orden.',
  }).message;
}
