export type ErrorKind =
  | 'invalid_credentials'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'network'
  | 'unavailable'
  | 'not_staff'
  | 'unknown';

/** Error raised by the domain or data layers. The UI decides how to word it. */
export class AppError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly correlationId?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
