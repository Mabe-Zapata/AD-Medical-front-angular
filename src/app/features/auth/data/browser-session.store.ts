import { Injectable } from '@angular/core';

import { Session } from '../domain/entities/session';
import { SessionStore } from '../domain/ports/auth.ports';

const KEY = 'medilo.staff.session';

interface StoredSession {
  token: string;
  expiresAt: number;
  user: { id: string; email?: string; roles: string[]; permissions: string[] };
}

/**
 * Keeps the session in `sessionStorage`: it survives a reload but not closing the tab, and it is
 * never shared with other tabs. Storage can be unavailable (private mode), so every access is guarded.
 */
@Injectable()
export class BrowserSessionStore extends SessionStore {
  load(): Session | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw === null) return null;
      const data = JSON.parse(raw) as Partial<StoredSession>;
      const user = data.user;
      if (
        typeof data.token !== 'string' ||
        typeof data.expiresAt !== 'number' ||
        !user ||
        typeof user.id !== 'string' ||
        !Array.isArray(user.roles) ||
        !Array.isArray(user.permissions)
      ) {
        this.clear();
        return null;
      }
      return new Session(data.token, data.expiresAt, user);
    } catch {
      return null;
    }
  }

  save(session: Session): void {
    try {
      const data: StoredSession = {
        token: session.token,
        expiresAt: session.expiresAt,
        user: {
          id: session.user.id,
          email: session.user.email,
          roles: [...session.user.roles],
          permissions: [...session.user.permissions],
        },
      };
      sessionStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // The session still works in memory for this page load.
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // Nothing to clear.
    }
  }
}
