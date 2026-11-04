import { TestBed } from '@angular/core/testing';

import { Session } from '../domain/entities/session';
import { RestoreSession, SignOut } from '../domain/usecases/session-lifecycle';
import { SignIn } from '../domain/usecases/sign-in';
import { SessionState } from './session.state';

describe('SessionState', () => {
  const profile = { id: 'u1', roles: ['MEDICO'], permissions: ['conocimiento.leer'] };
  const signOutUseCase = { execute: vi.fn() };

  function create(signIn: () => Promise<Session>, restored: Session | null = null): SessionState {
    TestBed.configureTestingModule({
      providers: [
        { provide: SignIn, useValue: { execute: signIn } },
        { provide: SignOut, useValue: signOutUseCase },
        { provide: RestoreSession, useValue: { execute: () => restored } },
      ],
    });
    return TestBed.inject(SessionState);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    signOutUseCase.execute.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('exposes the permissions of the signed-in user', async () => {
    const state = create(async () => new Session('t', Date.now() + 60_000, profile));
    expect(state.isSignedIn()).toBe(false);

    await state.signIn('a@b.test', 'pw');

    expect(state.isSignedIn()).toBe(true);
    expect(state.can('conocimiento.leer')).toBe(true);
    expect(state.can('conocimiento.administrar')).toBe(false);
  });

  it('ends the session by itself when the token expires', async () => {
    const state = create(async () => new Session('t', Date.now() + 15 * 60_000, profile));
    await state.signIn('a@b.test', 'pw');

    vi.advanceTimersByTime(15 * 60_000 + 1);

    expect(state.isSignedIn()).toBe(false);
    expect(state.endReason()).toBe('expirada');
    expect(signOutUseCase.execute).toHaveBeenCalled();
  });

  it('treats an expired session as inactive when a guard asks', async () => {
    const state = create(async () => new Session('t', Date.now() + 1_000, profile));
    await state.signIn('a@b.test', 'pw');

    expect(state.isActive(Date.now() + 2_000)).toBe(false);
    expect(state.endReason()).toBe('expirada');
  });

  it('records a manual sign out', async () => {
    const state = create(async () => new Session('t', Date.now() + 60_000, profile));
    await state.signIn('a@b.test', 'pw');

    state.signOut();

    expect(state.isSignedIn()).toBe(false);
    expect(state.endReason()).toBe('cerrada');
  });

  it('starts signed in when a valid session was restored', () => {
    const state = create(
      async () => new Session('x', 1, profile),
      new Session('t', Date.now() + 60_000, profile),
    );
    expect(state.isSignedIn()).toBe(true);
  });
});
