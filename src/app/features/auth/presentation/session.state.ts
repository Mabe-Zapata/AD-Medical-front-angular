import { Injectable, computed, inject, signal } from '@angular/core';

import { Session } from '../domain/entities/session';
import { RestoreSession, SignOut } from '../domain/usecases/session-lifecycle';
import { SignIn } from '../domain/usecases/sign-in';

export type EndReason = 'expirada' | 'cerrada';

/** Reactive holder of the current session. Pages read it; only this class changes it. */
@Injectable({ providedIn: 'root' })
export class SessionState {
  private readonly signInUseCase = inject(SignIn);
  private readonly signOutUseCase = inject(SignOut);
  private readonly current = signal<Session | null>(inject(RestoreSession).execute());
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly session = this.current.asReadonly();
  readonly isSignedIn = computed(() => this.current() !== null);
  readonly user = computed(() => this.current()?.user ?? null);
  /** Why the last session ended, so the login page can explain it. */
  readonly endReason = signal<EndReason | null>(null);

  constructor() {
    this.armExpiry();
  }

  async signIn(email: string, password: string): Promise<Session> {
    const session = await this.signInUseCase.execute(email, password);
    this.current.set(session);
    this.endReason.set(null);
    this.armExpiry();
    return session;
  }

  signOut(reason: EndReason = 'cerrada'): void {
    clearTimeout(this.timer);
    this.signOutUseCase.execute();
    this.current.set(null);
    this.endReason.set(reason);
  }

  /** True while the session exists and has not expired; ends it otherwise (guards call this). */
  isActive(now = Date.now()): boolean {
    const session = this.current();
    if (session === null) return false;
    if (session.isExpired(now)) {
      this.signOut('expirada');
      return false;
    }
    return true;
  }

  can(permission: string): boolean {
    return this.current()?.can(permission) ?? false;
  }

  private armExpiry(): void {
    clearTimeout(this.timer);
    const session = this.current();
    if (session === null) return;
    // setTimeout caps at about 24.8 days; a 15-minute token is far below that.
    const delay = Math.min(Math.max(session.expiresAt - Date.now(), 0), 2_000_000_000);
    this.timer = setTimeout(() => this.signOut('expirada'), delay);
  }
}
