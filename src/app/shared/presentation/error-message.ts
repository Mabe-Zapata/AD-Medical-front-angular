import { AppError, ErrorKind } from '../../core/domain/app-error';

/** Something to tell the person, in plain Spanish. It never carries technical codes: they stay in the logs. */
export interface ErrorView {
  readonly message: string;
}

const MESSAGES: Readonly<Record<ErrorKind, string>> = {
  invalid_credentials: 'Ese correo y esa contraseña no coinciden. Revísalos e inténtalo otra vez.',
  unauthenticated: 'Tu sesión se cerró. Inicia sesión de nuevo para continuar.',
  forbidden: 'Tu cuenta no tiene acceso a esta sección.',
  not_found: 'No encontramos lo que buscas. Puede que ya no exista.',
  conflict: 'Alguien actualizó esto al mismo tiempo que tú. Vuelve a cargar e inténtalo de nuevo.',
  validation: 'Hay datos que no pudimos aceptar. Revísalos y vuelve a intentarlo.',
  rate_limited: 'Hiciste varios intentos seguidos. Espera un minuto y vuelve a probar.',
  network: 'No pudimos conectarnos. Revisa tu internet y vuelve a intentarlo.',
  unavailable: 'El servicio está tardando más de lo normal. Inténtalo de nuevo en unos minutos.',
  not_staff: 'Esta cuenta es de paciente. Ingresa al portal del paciente.',
  unknown: 'Algo salió mal de nuestro lado. Inténtalo de nuevo; si sigue pasando, avisa al administrador.',
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
  return { message };
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
