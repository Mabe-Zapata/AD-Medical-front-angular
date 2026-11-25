import { Session, UserProfile } from '../entities/session';

/** Why an activation link cannot be used, or VALID when it still can. */
export type ActivationStatus = 'VALID' | 'USED' | 'EXPIRED' | 'INVALID';

export interface IssuedToken {
  readonly token: string;
  readonly expiresInSeconds: number;
}

/** Port to the identity API. Implemented in the data layer. */
export abstract class AuthRepository {
  abstract login(email: string, password: string): Promise<IssuedToken>;
  /** Takes the token explicitly: the session does not exist yet while signing in. */
  abstract fetchProfile(token: string): Promise<UserProfile>;
  /** Sets the password of a staff account from the one-time link sent by email. */
  abstract activateStaffAccount(token: string, password: string): Promise<void>;
  /** Asks for a reset link. The answer is the same whether or not the account exists. */
  abstract requestPasswordReset(email: string): Promise<void>;
  /** Why a reset link cannot be used, or VALID when it still can. */
  abstract resetStatus(token: string): Promise<ActivationStatus>;
  /** Sets the new password behind a reset link, once. */
  abstract confirmPasswordReset(token: string, password: string): Promise<void>;
  /** Asked when the activation page opens, so a used or expired link is refused before any form is shown. */
  abstract activationStatus(token: string): Promise<ActivationStatus>;
}

/** Port to wherever the session survives a page reload. */
export abstract class SessionStore {
  abstract load(): Session | null;
  abstract save(session: Session): void;
  abstract clear(): void;
}
