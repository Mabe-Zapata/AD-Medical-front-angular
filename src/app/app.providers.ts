import { Provider, inject } from '@angular/core';

import { environment } from '../environments/environment';
import { AppSettings, APP_SETTINGS } from './core/config/app-settings';
import { BrowserSessionStore } from './features/auth/data/browser-session.store';
import { HttpAuthRepository } from './features/auth/data/http-auth.repository';
import { AuthRepository, SessionStore } from './features/auth/domain/ports/auth.ports';
import { RestoreSession, SignOut } from './features/auth/domain/usecases/session-lifecycle';
import { SignIn } from './features/auth/domain/usecases/sign-in';
import { HttpOrdersRepository } from './features/orders/data/http-orders.repository';
import { OrdersRepository } from './features/orders/domain/ports/orders.repository';
import { ShadowRepository } from './features/orders/domain/ports/shadow.repository';
import { HttpShadowRepository } from './features/orders/data/http-shadow.repository';
import {
  EditShadowFinding,
  GetShadowReport,
  ListShadowEdits,
  RecordShadowSnapshot,
} from './features/orders/domain/usecases/shadow-usecases';
import {
  CreateOrder,
  DecideProposal,
  DownloadDocument,
  EvaluateOrder,
  GetOrder,
  GetProposal,
  ListOrderResults,
  ListOrders,
  ListPatients,
  ListTestTypes,
  ListWorklist,
  ListTestAnalytes,
  ListOrderDocuments,
  ConfirmOrder,
  RecordResults,
  ReviewOrder,
  UploadReport,
} from './features/orders/domain/usecases/orders-usecases';
import { HttpUsersRepository } from './features/users/data/http-users.repository';
import { UsersRepository } from './features/users/domain/ports/users.repository';
import { CreateUser, ListUsers } from './features/users/domain/usecases/users-usecases';
import { HttpAgendaRepository } from './features/agenda/data/http-agenda.repository';
import { AgendaRepository } from './features/agenda/domain/ports/agenda.ports';
import { ApproveCancellation } from './features/agenda/domain/usecases/approve-cancellation';
import { CancelDoctorAppointment } from './features/agenda/domain/usecases/cancel-appointment';
import { ListAgenda } from './features/agenda/domain/usecases/list-agenda';
import { OpenConsultation } from './features/agenda/domain/usecases/open-consultation';
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

/**
 * Composition root: the only place that knows which adapter implements each port.
 * To change a backend or a storage, change the class here and nothing else.
 */
export const appProviders: Provider[] = [
  {
    provide: APP_SETTINGS,
    useFactory: (): AppSettings => ({
      apiBaseUrl: environment.apiBaseUrl,
      defaultSourceId: environment.defaultSourceId || null,
      patientPortalUrl: environment.patientPortalUrl || null,
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
  { provide: ListPatients, useFactory: () => new ListPatients(inject(OrdersRepository)) },
  { provide: ListTestTypes, useFactory: () => new ListTestTypes(inject(OrdersRepository)) },
  { provide: ListWorklist, useFactory: () => new ListWorklist(inject(OrdersRepository)) },
  { provide: ConfirmOrder, useFactory: () => new ConfirmOrder(inject(OrdersRepository)) },
  { provide: ListOrderDocuments, useFactory: () => new ListOrderDocuments(inject(OrdersRepository)) },
  { provide: DownloadDocument, useFactory: () => new DownloadDocument(inject(OrdersRepository)) },
  { provide: ListTestAnalytes, useFactory: () => new ListTestAnalytes(inject(OrdersRepository)) },
  { provide: GetOrder, useFactory: () => new GetOrder(inject(OrdersRepository)) },
  { provide: ListOrderResults, useFactory: () => new ListOrderResults(inject(OrdersRepository)) },
  { provide: RecordResults, useFactory: () => new RecordResults(inject(OrdersRepository)) },
  { provide: UploadReport, useFactory: () => new UploadReport(inject(OrdersRepository)) },
  { provide: EvaluateOrder, useFactory: () => new EvaluateOrder(inject(OrdersRepository)) },
  { provide: GetProposal, useFactory: () => new GetProposal(inject(OrdersRepository)) },
  { provide: DecideProposal, useFactory: () => new DecideProposal(inject(OrdersRepository)) },
  { provide: ReviewOrder, useFactory: () => new ReviewOrder(inject(OrdersRepository)) },
  { provide: ShadowRepository, useClass: HttpShadowRepository },
  { provide: GetShadowReport, useFactory: () => new GetShadowReport(inject(ShadowRepository)) },
  {
    provide: RecordShadowSnapshot,
    useFactory: () => new RecordShadowSnapshot(inject(ShadowRepository)),
  },
  { provide: EditShadowFinding, useFactory: () => new EditShadowFinding(inject(ShadowRepository)) },
  { provide: ListShadowEdits, useFactory: () => new ListShadowEdits(inject(ShadowRepository)) },

  // users
  { provide: UsersRepository, useClass: HttpUsersRepository },
  { provide: ListUsers, useFactory: () => new ListUsers(inject(UsersRepository)) },
  { provide: CreateUser, useFactory: () => new CreateUser(inject(UsersRepository)) },

  // agenda
  { provide: AgendaRepository, useClass: HttpAgendaRepository },
  { provide: ListAgenda, useFactory: () => new ListAgenda(inject(AgendaRepository)) },
  {
    provide: CancelDoctorAppointment,
    useFactory: () => new CancelDoctorAppointment(inject(AgendaRepository)),
  },
  {
    provide: ApproveCancellation,
    useFactory: () => new ApproveCancellation(inject(AgendaRepository)),
  },
  {
    provide: OpenConsultation,
    useFactory: () => new OpenConsultation(inject(AgendaRepository)),
  },
];
