import { Session } from '../entities/session';
import { SessionStore } from '../ports/auth.ports';

export class SignOut {
  constructor(private readonly store: SessionStore) {}

  execute(): void {
    this.store.clear();
  }
}

/** Reads the stored session after a reload and drops it if it already expired. */
export class RestoreSession {
  constructor(
    private readonly store: SessionStore,
    private readonly now: () => number = Date.now,
  ) {}

  execute(): Session | null {
    const session = this.store.load();
    if (session === null) return null;
    if (session.isExpired(this.now())) {
      this.store.clear();
      return null;
    }
    return session;
  }
}
