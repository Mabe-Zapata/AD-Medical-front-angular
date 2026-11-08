import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';

import { authGuard, guestGuard, permissionGuard } from './guards';
import { SessionState } from './session.state';

describe('route guards', () => {
  function run(
    guard: CanActivateFn,
    state: { active: boolean; can?: boolean },
    url = '/conocimiento',
  ) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SessionState,
          useValue: { isActive: () => state.active, can: () => state.can ?? false },
        },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    const router = TestBed.inject(Router);
    return typeof result === 'boolean' ? result : router.serializeUrl(result as never);
  }

  it('lets a signed-in user through', () => {
    expect(run(authGuard, { active: true })).toBe(true);
  });

  it('sends an anonymous user to the login and remembers the destination', () => {
    expect(run(authGuard, { active: false }, '/conocimiento/reglas')).toBe(
      '/login?redirect=%2Fconocimiento%2Freglas',
    );
  });

  it('keeps signed-in users away from the login page', () => {
    expect(run(guestGuard, { active: true })).toBe('/inicio');
    TestBed.resetTestingModule();
    expect(run(guestGuard, { active: false })).toBe(true);
  });

  it('redirects to the start page when the permission is missing', () => {
    expect(run(permissionGuard('conocimiento.leer'), { active: true, can: false })).toBe(
      '/inicio?sinPermiso=1',
    );
    TestBed.resetTestingModule();
    expect(run(permissionGuard('conocimiento.leer'), { active: true, can: true })).toBe(true);
  });
});
