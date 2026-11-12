import { Provider, inject, isDevMode } from '@angular/core';

import { AppSettings, APP_SETTINGS } from './core/config/app-settings';
import { BrowserSessionStore } from './features/auth/data/browser-session.store';
import { HttpAuthRepository } from './features/auth/data/http-auth.repository';
import { AuthRepository, SessionStore } from './features/auth/domain/ports/auth.ports';
import { RestoreSession, SignOut } from './features/auth/domain/usecases/session-lifecycle';
import { SignIn } from './features/auth/domain/usecases/sign-in';
import { HttpOrdersRepository } from './features/orders/data/http-orders.repository';
import { OrdersRepository } from './features/orders/domain/ports/orders.repository';
import {
  CreateOrder,
  DecideProposal,
  EvaluateOrder,
  GetOrder,
  GetProposal,
  ListOrderResults,
  ListOrders,
  RecordResults,
  ReviewOrder,
  UploadReport,
} from './features/orders/domain/usecases/orders-usecases';
import { HttpUsersRepository } from './features/users/data/http-users.repository';
import { UsersRepository } from './features/users/domain/ports/users.repository';
import { CreateUser, ListUsers } from './features/users/domain/usecases/users-usecases';
import { HttpKnowledgeRepository } from './features/knowledge/data/http-knowledge.repository';
import { KnowledgeRepository } from './features/knowledge/domain/ports/knowledge.repository';
import {
  CreateAnalyte,
  CreateReferenceDraft,
  CreateRuleDraft,
  ListAnalytes,
  GetKnowledgeSummary,
  ListDrafts,
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
      // In development the Flutter portal is served on 4300; in production set the real address here.
      patientPortalUrl: isDevMode() ? 'http://localhost:4300' : null,
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
  { provide: ListDrafts, useFactory: () => new ListDrafts(inject(KnowledgeRepository)) },
  {
    provide: GetKnowledgeSummary,
    useFactory: () => new GetKnowledgeSummary(inject(KnowledgeRepository)),
  },

  // orders
  { provide: OrdersRepository, useClass: HttpOrdersRepository },
  { provide: CreateOrder, useFactory: () => new CreateOrder(inject(OrdersRepository)) },
  { provide: ListOrders, useFactory: () => new ListOrders(inject(OrdersRepository)) },
  { provide: GetOrder, useFactory: () => new GetOrder(inject(OrdersRepository)) },
  { provide: ListOrderResults, useFactory: () => new ListOrderResults(inject(OrdersRepository)) },
  { provide: RecordResults, useFactory: () => new RecordResults(inject(OrdersRepository)) },
  { provide: UploadReport, useFactory: () => new UploadReport(inject(OrdersRepository)) },
  { provide: EvaluateOrder, useFactory: () => new EvaluateOrder(inject(OrdersRepository)) },
  { provide: GetProposal, useFactory: () => new GetProposal(inject(OrdersRepository)) },
  { provide: DecideProposal, useFactory: () => new DecideProposal(inject(OrdersRepository)) },
  { provide: ReviewOrder, useFactory: () => new ReviewOrder(inject(OrdersRepository)) },

  // users
  { provide: UsersRepository, useClass: HttpUsersRepository },
  { provide: ListUsers, useFactory: () => new ListUsers(inject(UsersRepository)) },
  { provide: CreateUser, useFactory: () => new CreateUser(inject(UsersRepository)) },
];
