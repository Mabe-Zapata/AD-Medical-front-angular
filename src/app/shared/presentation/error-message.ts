import { AppError, ErrorKind } from '../../core/domain/app-error';

export interface ErrorView {
  readonly message: string;
  /** Correlation id the backend returned, so support can find the request in the logs. */
  readonly supportCode?: string;
}

const MESSAGES: Readonly<Record<ErrorKind, string>> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  unauthenticated: 'Tu sesión terminó. Inicia sesión de nuevo.',
  forbidden: 'No tienes permiso para realizar esta acción.',
  not_found: 'No se encontró el recurso solicitado.',
  conflict: 'La operación entra en conflicto con el estado actual del recurso.',
  validation: 'Los datos enviados no son válidos.',
  rate_limited: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
  network: 'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.',
  unavailable:
    'El servidor no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
  not_staff: 'Esta cuenta es de paciente. Ingresa al portal del paciente.',
  unknown: 'Ocurrió un error inesperado.',
};

/** Turns any thrown value into Spanish copy. `overrides` lets a screen say something more precise. */
export function describeError(
  error: unknown,
  overrides: Partial<Record<ErrorKind, string>> = {},
): ErrorView {
  const appError = error instanceof AppError ? error : new AppError('unknown', String(error));
  let message = overrides[appError.kind] ?? MESSAGES[appError.kind];
  // The backend reports which fields failed (never their values), which helps the user fix the form.
  if (appError.kind === 'validation' && !overrides.validation && appError.message) {
    message += ` ${appError.message}`;
  }
  return { message, supportCode: appError.correlationId };
}
