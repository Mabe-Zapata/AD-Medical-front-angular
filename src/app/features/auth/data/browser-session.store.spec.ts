import { Session } from '../domain/entities/session';
import { BrowserSessionStore } from './browser-session.store';

const KEY = 'medilo.staff.session';

describe('BrowserSessionStore', () => {
  const store = new BrowserSessionStore();
  const session = new Session('jwt', 5_000, { id: 'u1', roles: ['MEDICO'], permissions: ['a'] });

  beforeEach(() => sessionStorage.clear());

  it('round-trips a session', () => {
    store.save(session);
    const loaded = store.load();

    expect(loaded?.token).toBe('jwt');
    expect(loaded?.expiresAt).toBe(5_000);
    expect(loaded?.user).toEqual({ id: 'u1', roles: ['MEDICO'], permissions: ['a'] });
  });

  it('returns null when nothing is stored', () => {
    expect(store.load()).toBeNull();
  });

  it('ignores and removes malformed data', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ token: 1 }));
    expect(store.load()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('survives corrupted JSON', () => {
    sessionStorage.setItem(KEY, '{not json');
    expect(store.load()).toBeNull();
  });

  it('clears the stored session', () => {
    store.save(session);
    store.clear();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
