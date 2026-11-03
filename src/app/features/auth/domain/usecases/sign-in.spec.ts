import { AppError } from '../../../../core/domain/app-error';
import { Session, UserProfile } from '../entities/session';
import { AuthRepository, IssuedToken, SessionStore } from '../ports/auth.ports';
import { RestoreSession, SignOut } from './session-lifecycle';
import { SignIn } from './sign-in';

class FakeAuth extends AuthRepository {
  loginCalls: string[][] = [];
  profileCalls: string[] = [];

  constructor(
    private readonly profile: UserProfile,
    private readonly failure?: AppError,
  ) {
    super();
  }

  async login(email: string, password: string): Promise<IssuedToken> {
    this.loginCalls.push([email, password]);
    if (this.failure) throw this.failure;
    return { token: 'jwt-token', expiresInSeconds: 900 };
  }

  async fetchProfile(token: string): Promise<UserProfile> {
    this.profileCalls.push(token);
    return this.profile;
  }
}

class MemoryStore extends SessionStore {
  stored: Session | null = null;
  load(): Session | null {
    return this.stored;
  }
  save(session: Session): void {
    this.stored = session;
  }
  clear(): void {
    this.stored = null;
  }
}

const doctor: UserProfile = {
  id: 'u1',
  roles: ['MEDICO'],
  permissions: ['conocimiento.leer', 'conocimiento.validar'],
};
const patient: UserProfile = { id: 'u2', roles: ['PACIENTE'], permissions: ['citas.reservar'] };

describe('SignIn', () => {
  it('stores a session that expires with the token for a staff account', async () => {
    const store = new MemoryStore();
    const signIn = new SignIn(new FakeAuth(doctor), store, () => 1_000_000);

    const session = await signIn.execute('  Doctor@Demo.TEST ', 'secret');

    expect(session.expiresAt).toBe(1_000_000 + 900_000);
    expect(session.can('conocimiento.validar')).toBe(true);
    expect(store.stored).toBe(session);
  });

  it('sends a trimmed, lower-case email to the API', async () => {
    const auth = new FakeAuth(doctor);
    await new SignIn(auth, new MemoryStore()).execute('  Doctor@Demo.TEST ', 'secret');
    expect(auth.loginCalls).toEqual([['doctor@demo.test', 'secret']]);
  });

  it('rejects a patient account and keeps nothing', async () => {
    const store = new MemoryStore();

    await expect(
      new SignIn(new FakeAuth(patient), store).execute('p@demo.test', 'x'),
    ).rejects.toMatchObject({
      kind: 'not_staff',
    });
    expect(store.stored).toBeNull();
  });

  it('propagates wrong credentials without asking for the profile', async () => {
    const auth = new FakeAuth(doctor, new AppError('invalid_credentials', 'nope'));

    await expect(
      new SignIn(auth, new MemoryStore()).execute('a@b.test', 'bad'),
    ).rejects.toMatchObject({
      kind: 'invalid_credentials',
    });
    expect(auth.profileCalls).toEqual([]);
  });

  it('does not call the API for an empty email or password', async () => {
    const auth = new FakeAuth(doctor);
    const signIn = new SignIn(auth, new MemoryStore());

    await expect(signIn.execute('  ', 'x')).rejects.toMatchObject({ kind: 'validation' });
    await expect(signIn.execute('a@b.test', '')).rejects.toMatchObject({ kind: 'validation' });
    expect(auth.loginCalls).toEqual([]);
  });
});

describe('RestoreSession and SignOut', () => {
  const live = new Session('t', 2_000, doctor);

  it('restores a session that has not expired', () => {
    const store = new MemoryStore();
    store.save(live);
    expect(new RestoreSession(store, () => 1_000).execute()).toBe(live);
  });

  it('drops an expired session from the store', () => {
    const store = new MemoryStore();
    store.save(live);
    expect(new RestoreSession(store, () => 2_000).execute()).toBeNull();
    expect(store.stored).toBeNull();
  });

  it('clears the store on sign out', () => {
    const store = new MemoryStore();
    store.save(live);
    new SignOut(store).execute();
    expect(store.stored).toBeNull();
  });
});
