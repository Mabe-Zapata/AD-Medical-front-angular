import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { APP_SETTINGS } from './core/config/app-settings';
import { SessionState } from './features/auth/presentation/session.state';

/**
 * Adds the bearer token to API calls and ends the session when the API says it is no longer valid.
 * Requests that already carry an Authorization header (the profile call while signing in) are left alone.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const state = inject(SessionState);
  const isApi = request.url.startsWith(inject(APP_SETTINGS).apiBaseUrl);
  const session = state.session();

  const outgoing =
    isApi && session && !request.headers.has('Authorization')
      ? request.clone({ setHeaders: { Authorization: `Bearer ${session.token}` } })
      : request;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      const rejectedSession =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApi &&
        session !== null &&
        !request.url.endsWith('/auth/login');
      if (rejectedSession) state.signOut('expirada');
      return throwError(() => error);
    }),
  );
};
