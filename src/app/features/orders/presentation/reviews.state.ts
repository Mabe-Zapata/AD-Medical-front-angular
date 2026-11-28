import { Injectable, effect, inject, signal } from '@angular/core';

import { SessionState } from '../../auth/presentation/session.state';

export interface RegisteredReview {
  readonly conclusion: string;
  readonly recommendations: string | null;
  readonly registeredAt: Date;
}

/**
 * Reviews registered from this browser during the session. The API accepts one review per order and
 * has no endpoint to read it back, so this is the only place the person can see what they wrote.
 */
@Injectable({ providedIn: 'root' })
export class ReviewsState {
  private readonly items = signal<Readonly<Record<string, RegisteredReview>>>({});

  constructor() {
    // A review belongs to the person who wrote it: forget it when the session ends.
    const session = inject(SessionState);
    effect(() => {
      if (!session.isSignedIn()) this.items.set({});
    });
  }

  of(orderId: string): RegisteredReview | null {
    return this.items()[orderId] ?? null;
  }

  add(orderId: string, review: RegisteredReview): void {
    this.items.update((all) => ({ ...all, [orderId]: review }));
  }
}
