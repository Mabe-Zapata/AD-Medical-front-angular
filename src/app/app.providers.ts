import { Provider, inject, isDevMode } from '@angular/core';

import { AppSettings, APP_SETTINGS } from './core/config/app-settings';
import { BrowserSessionStore } from './features/auth/data/browser-session.store';
import { HttpAuthRepository } from './features/auth/data/http-auth.repository';
import { AuthRepository, SessionStore } from './features/auth/domain/ports/auth.ports';
import { RestoreSession, SignOut } from './features/auth/domain/usecases/session-lifecycle';
import { SignIn } from './features/auth/domain/usecases/sign-in';
import { HttpKnowledgeRepository } from './features/knowledge/data/http-knowledge.repository';
import { KnowledgeRepository } from './features/knowledge/domain/ports/knowledge.repository';
import {
  CreateAnalyte,
  CreateReferenceDraft,
  CreateRuleDraft,
  ListAnalytes,
  ListReferences,
  ValidateReference,
  ValidateRule,
} from './features/knowledge/domain/usecases/knowledge-usecases';

/** Reference source created by the backend's synthetic seed, offered only in development. */
const SEED_SOURCE_ID = 'f0000000-0000-4000-8000-000000000001';

/**
 * Composition root: the only place that knows which adapter implements each port.
 * To change a backend or a storage, change the class here and nothing else.
 */
export const appProviders: Provider[] = [
  {
    provide: APP_SETTINGS,
    useFactory: (): AppSettings => ({
      apiBaseUrl: '/api/v1',
      defaultSourceId: isDevMode() ? SEED_SOURCE_ID : null,
    }),
  },

  // auth
  { provide: AuthRepository, useClass: HttpAuthRepository },
  { provide: SessionStore, useClass: BrowserSessionStore },
  { provide: SignIn, useFactory: () => new SignIn(inject(AuthRepository), inject(SessionStore)) },
  { provide: SignOut, useFactory: () => new SignOut(inject(SessionStore)) },
  { provide: RestoreSession, useFactory: () => new RestoreSession(inject(SessionStore)) },

  // knowledge
  { provide: KnowledgeRepository, useClass: HttpKnowledgeRepository },
  { provide: ListAnalytes, useFactory: () => new ListAnalytes(inject(KnowledgeRepository)) },
  { provide: CreateAnalyte, useFactory: () => new CreateAnalyte(inject(KnowledgeRepository)) },
  { provide: ListReferences, useFactory: () => new ListReferences(inject(KnowledgeRepository)) },
  {
    provide: CreateReferenceDraft,
    useFactory: () => new CreateReferenceDraft(inject(KnowledgeRepository)),
  },
  {
    provide: ValidateReference,
    useFactory: () => new ValidateReference(inject(KnowledgeRepository)),
  },
  { provide: CreateRuleDraft, useFactory: () => new CreateRuleDraft(inject(KnowledgeRepository)) },
  { provide: ValidateRule, useFactory: () => new ValidateRule(inject(KnowledgeRepository)) },
];
