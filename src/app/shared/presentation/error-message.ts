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
  not_found: 'No encontramos lo que buscas.',
  conflict: 'No se pudo completar la acción porque los datos cambiaron. Inténtalo de nuevo.',
  validation: 'Revisa los datos ingresados e inténtalo de nuevo.',
  rate_limited: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
  network: 'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.',
  unavailable:
    'El servidor no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
  not_staff: 'Esta cuenta es de paciente. Ingresa al portal del paciente.',
  unknown: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
};

/** Names of the fields the API can report, as the person reads them. */
const FIELD_NAMES: Readonly<Record<string, string>> = {
  email: 'el correo',
  password: 'la contraseña',
  nombre: 'el nombre',
  unidad: 'la unidad',
  tipo_valor: 'el tipo de valor',
  codigo: 'el código',
  mensaje: 'el mensaje',
  expresion_logica: 'la lógica de la regla',
  criterios: 'los criterios',
  fecha_inicio: 'la fecha de inicio',
  fecha_fin: 'la fecha de fin',
  minimo: 'el mínimo',
  maximo: 'el máximo',
};

/**
 * Turns any thrown value into Spanish copy. `overrides` lets a screen say something more precise.
 * `AppError.message` is internal (English, for logs and tests) and is never shown; the only thing
 * taken from it is the list of rejected fields, translated.
 */
export function describeError(
  error: unknown,
  overrides: Partial<Record<ErrorKind, string>> = {},
): ErrorView {
  const appError = error instanceof AppError ? error : new AppError('unknown', String(error));
  const message =
    overrides[appError.kind] ??
    (appError.kind === 'validation' ? validationMessage(appError) : MESSAGES[appError.kind]);
  return { message, supportCode: appError.correlationId };
}

function validationMessage(error: AppError): string {
  const fields = /^Invalid fields: (.+)$/.exec(error.message)?.[1] ?? '';
  const names = [
    ...new Set(
      fields
        .split(',')
        .map((field) => FIELD_NAMES[field.trim()])
        .filter((name): name is string => !!name),
    ),
  ];
  if (names.length === 0) return MESSAGES.validation;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
  return `Revisa ${list} e inténtalo de nuevo.`;
}
