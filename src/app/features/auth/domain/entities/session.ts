export interface UserProfile {
  readonly id: string;
  /** Typed at sign-in: `/me` does not return it. Absent in sessions saved before it was kept. */
  readonly email?: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

/** A signed-in staff member: the bearer token, when it stops being valid and who owns it. */
export class Session {
  constructor(
    readonly token: string,
    /** Epoch milliseconds. */
    readonly expiresAt: number,
    readonly user: UserProfile,
  ) {}

  isExpired(now: number): boolean {
    return now >= this.expiresAt;
  }

  /** UI hint only: the backend authorizes every request on its own. */
  can(permission: string): boolean {
    return this.user.permissions.includes(permission);
  }
}
