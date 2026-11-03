import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionState } from './session.state';

/** Pages that need a signed-in staff member. Remembers where the user was heading. */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(SessionState).isActive()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

/** The login page is pointless once signed in. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(SessionState).isActive() ? router.createUrlTree(['/inicio']) : true;
};

/** UX gate: hides screens the role cannot use. The backend still authorizes every call. */
export const permissionGuard =
  (permission: string): CanActivateFn =>
  () => {
    const router = inject(Router);
    return inject(SessionState).can(permission)
      ? true
      : router.createUrlTree(['/inicio'], { queryParams: { sinPermiso: '1' } });
  };
