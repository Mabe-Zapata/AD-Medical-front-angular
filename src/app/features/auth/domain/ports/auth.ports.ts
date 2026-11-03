import { Session, UserProfile } from '../entities/session';

export interface IssuedToken {
  readonly token: string;
  readonly expiresInSeconds: number;
}

/** Port to the identity API. Implemented in the data layer. */
export abstract class AuthRepository {
  abstract login(email: string, password: string): Promise<IssuedToken>;
  /** Takes the token explicitly: the session does not exist yet while signing in. */
  abstract fetchProfile(token: string): Promise<UserProfile>;
}

/** Port to wherever the session survives a page reload. */
export abstract class SessionStore {
  abstract load(): Session | null;
  abstract save(session: Session): void;
  abstract clear(): void;
}
