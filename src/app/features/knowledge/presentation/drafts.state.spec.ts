import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SessionState } from '../../auth/presentation/session.state';
import { Draft } from '../domain/entities/knowledge';
import { DraftsState } from './drafts.state';

const draft = (id: string): Draft => ({
  kind: 'rule',
  id,
  label: `Regla ${id}`,
  state: 'BORRADOR',
});

describe('DraftsState', () => {
  const signedIn = signal(true);

  function create(): DraftsState {
    signedIn.set(true);
    TestBed.configureTestingModule({
      providers: [{ provide: SessionState, useValue: { isSignedIn: signedIn } }],
    });
    return TestBed.inject(DraftsState);
  }

  it('keeps the newest draft first and does not duplicate ids', () => {
    const state = create();
    state.add(draft('a'));
    state.add(draft('b'));
    state.add(draft('a'));

    expect(state.drafts().map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('marks a draft as validated', () => {
    const state = create();
    state.add(draft('a'));
    state.markValidated('a');

    expect(state.drafts()[0].state).toBe('VALIDADA');
  });

  it('forgets every draft when the session ends', () => {
    const state = create();
    TestBed.tick();
    state.add(draft('a'));

    signedIn.set(false);
    TestBed.tick();

    expect(state.drafts()).toEqual([]);
  });
});
