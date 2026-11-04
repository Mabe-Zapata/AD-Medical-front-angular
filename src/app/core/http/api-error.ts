import { HttpErrorResponse } from '@angular/common/http';

import { AppError, ErrorKind } from '../domain/app-error';

interface ProblemBody {
  detail?: unknown;
  correlation_id?: unknown;
}

const KIND_BY_STATUS: Record<number, ErrorKind> = {
  0: 'network',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'validation',
  429: 'rate_limited',
  // Nginx or the load balancer answers these when no replica is up, or the database is down (503).
  502: 'unavailable',
  503: 'unavailable',
  504: 'unavailable',
};

/**
 * Maps an HTTP failure (RFC 9457 problem+json from the backend) to an {@link AppError}.
 * `unauthorizedAs` lets the login call report a 401 as wrong credentials instead of an expired session.
 */
export function toAppError(error: unknown, options: { unauthorizedAs?: ErrorKind } = {}): AppError {
  if (error instanceof AppError) return error;
  if (!(error instanceof HttpErrorResponse)) return new AppError('unknown', 'Unexpected error');

  const body: ProblemBody =
    typeof error.error === 'object' && error.error !== null ? error.error : {};
  const detail = typeof body.detail === 'string' ? body.detail : error.message;
  const correlationId = typeof body.correlation_id === 'string' ? body.correlation_id : undefined;
  const kind: ErrorKind =
    error.status === 401
      ? (options.unauthorizedAs ?? 'unauthenticated')
      : (KIND_BY_STATUS[error.status] ?? 'unknown');
  return new AppError(kind, detail, correlationId, error.status);
}
