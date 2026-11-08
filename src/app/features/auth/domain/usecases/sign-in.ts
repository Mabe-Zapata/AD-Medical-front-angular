import { AppError } from '../../../../core/domain/app-error';
import { Session } from '../entities/session';
import { isStaff } from '../policies/staff-access';
import { AuthRepository, SessionStore } from '../ports/auth.ports';

export class SignIn {
  constructor(
    private readonly auth: AuthRepository,
    private readonly store: SessionStore,
    private readonly now: () => number = Date.now,
  ) {}

  async execute(email: string, password: string): Promise<Session> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      throw new AppError('validation', 'Email and password are required');
    }

    const issued = await this.auth.login(normalized, password);
    const user = await this.auth.fetchProfile(issued.token);
    // A valid patient account is not an error of the backend, but it does not belong here:
    // nothing is stored and the token is discarded.
    if (!isStaff(user.roles)) {
      throw new AppError('not_staff', 'This account does not belong to the staff');
    }

    const session = new Session(issued.token, this.now() + issued.expiresInSeconds * 1000, user);
    this.store.save(session);
    return session;
  }
}
