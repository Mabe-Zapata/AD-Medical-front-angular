import { Injectable, effect, inject, signal } from '@angular/core';

import { SessionState } from '../../auth/presentation/session.state';
import { Draft } from '../domain/entities/knowledge';

/**
 * Drafts created in this browser session. The API never lists drafts (it only returns validated
 * references and has no listing for rules), so this is the only place a doctor can find them.
 */
@Injectable({ providedIn: 'root' })
export class DraftsState {
  private readonly items = signal<readonly Draft[]>([]);
  readonly drafts = this.items.asReadonly();

  constructor() {
    // Drafts belong to the person who made them: forget them when the session ends.
    const session = inject(SessionState);
    effect(() => {
      if (!session.isSignedIn()) this.items.set([]);
    });
  }

  add(draft: Draft): void {
    this.items.update((list) => [draft, ...list.filter((d) => d.id !== draft.id)]);
  }

  markValidated(id: string): void {
    this.items.update((list) =>
      list.map((d) => (d.id === id ? { ...d, state: 'VALIDADA' as const } : d)),
    );
  }
}
