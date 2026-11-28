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
  ReviewResults,
  ReviewOrder,
  UploadReport,
} from './features/orders/domain/usecases/orders-usecases';
import { HttpReportsRepository } from './features/reports/data/http-reports.repository';
import { ReportsRepository } from './features/reports/domain/ports/reports.repository';
import {
  GetMonitoringStatus,
  GetReportSummary,
} from './features/reports/domain/usecases/reports-usecases';
import { HttpUsersRepository } from './features/users/data/http-users.repository';
import { UsersRepository } from './features/users/domain/ports/users.repository';
import { CreateUser, ListUsers } from './features/users/domain/usecases/users-usecases';
import { HttpSedesRepository } from './features/sedes/data/http-sedes.repository';
import { HttpHistoriaRepository } from './features/historia/data/http-historia.repository';
import { HistoriaRepository } from './features/historia/domain/ports/historia.repository';
import { localIsoDay } from './features/historia/domain/policies/historia-policies';
import {
  ChangeEntryState,
  CorrectVitals,
  CreateEntry,
  ListHistoryPatients,
  ReadEvents,
  ReadHistory,
  RecordVitals,
  SearchCatalog,
  VerifyEntry,
} from './features/historia/domain/usecases/historia-usecases';
import { SedesRepository } from './features/sedes/domain/ports/sedes.repository';
import {
  AddOffice,
  CreateSedeWithOffices,
  ListSedes,
  UpdateOffice,
  UpdateSede,
} from './features/sedes/domain/usecases/sedes-usecases';
import { HttpAgendaRepository } from './features/agenda/data/http-agenda.repository';
import { AgendaRepository } from './features/agenda/domain/ports/agenda.ports';
import { ApproveCancellation } from './features/agenda/domain/usecases/approve-cancellation';
import { CancelDoctorAppointment } from './features/agenda/domain/usecases/cancel-appointment';
import { ListAgenda } from './features/agenda/domain/usecases/list-agenda';
import { ListCancellationCandidates } from './features/agenda/domain/usecases/list-cancellation-candidates';
import { OpenConsultation } from './features/agenda/domain/usecases/open-consultation';
import { HttpKnowledgeRepository } from './features/knowledge/data/http-knowledge.repository';
import { HttpWorkHoursRepository } from './features/horarios/data/http-work-hours.repository';
import { WorkHoursRepository } from './features/horarios/domain/ports/work-hours.repository';
import {
  GenerateWeek,
  GetDoctorWorkHours,
  GetMyWorkHours,
  ListConsultorios,
  ListDoctors,
  ProposeWeek,
  SaveMyWorkHours,
} from './features/horarios/domain/usecases/work-hours-usecases';
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
  { provide: ReviewResults, useFactory: () => new ReviewResults(inject(OrdersRepository)) },
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

  // doctor work hours and weekly planning
  { provide: WorkHoursRepository, useClass: HttpWorkHoursRepository },
  { provide: GetMyWorkHours, useFactory: () => new GetMyWorkHours(inject(WorkHoursRepository)) },
  { provide: SaveMyWorkHours, useFactory: () => new SaveMyWorkHours(inject(WorkHoursRepository)) },
  { provide: ListDoctors, useFactory: () => new ListDoctors(inject(WorkHoursRepository)) },
  { provide: GetDoctorWorkHours, useFactory: () => new GetDoctorWorkHours(inject(WorkHoursRepository)) },
  { provide: ListConsultorios, useFactory: () => new ListConsultorios(inject(WorkHoursRepository)) },
  { provide: ProposeWeek, useFactory: () => new ProposeWeek(inject(WorkHoursRepository)) },
  { provide: GenerateWeek, useFactory: () => new GenerateWeek(inject(WorkHoursRepository)) },

  // reports and monitoring
  { provide: ReportsRepository, useClass: HttpReportsRepository },
  { provide: GetReportSummary, useFactory: () => new GetReportSummary(inject(ReportsRepository)) },
  {
    provide: GetMonitoringStatus,
    useFactory: () => new GetMonitoringStatus(inject(ReportsRepository)),
  },

  // users
  { provide: UsersRepository, useClass: HttpUsersRepository },
  { provide: ListUsers, useFactory: () => new ListUsers(inject(UsersRepository)) },
  { provide: CreateUser, useFactory: () => new CreateUser(inject(UsersRepository)) },

  // sedes and consultorios
  { provide: SedesRepository, useClass: HttpSedesRepository },
  { provide: ListSedes, useFactory: () => new ListSedes(inject(SedesRepository)) },
  {
    provide: CreateSedeWithOffices,
    useFactory: () => new CreateSedeWithOffices(inject(SedesRepository)),
  },
  { provide: UpdateSede, useFactory: () => new UpdateSede(inject(SedesRepository)) },
  { provide: AddOffice, useFactory: () => new AddOffice(inject(SedesRepository)) },
  { provide: UpdateOffice, useFactory: () => new UpdateOffice(inject(SedesRepository)) },

  // clinical history (treating doctor)
  { provide: HistoriaRepository, useClass: HttpHistoriaRepository },
  { provide: ListHistoryPatients, useFactory: () => new ListHistoryPatients(inject(HistoriaRepository)) },
  { provide: ReadHistory, useFactory: () => new ReadHistory(inject(HistoriaRepository), () => localIsoDay(new Date())) },
  { provide: ReadEvents, useFactory: () => new ReadEvents(inject(HistoriaRepository), () => localIsoDay(new Date())) },
  { provide: CreateEntry, useFactory: () => new CreateEntry(inject(HistoriaRepository), () => localIsoDay(new Date())) },
  { provide: VerifyEntry, useFactory: () => new VerifyEntry(inject(HistoriaRepository)) },
  { provide: ChangeEntryState, useFactory: () => new ChangeEntryState(inject(HistoriaRepository)) },
  { provide: RecordVitals, useFactory: () => new RecordVitals(inject(HistoriaRepository)) },
  { provide: CorrectVitals, useFactory: () => new CorrectVitals(inject(HistoriaRepository)) },
  { provide: SearchCatalog, useFactory: () => new SearchCatalog(inject(HistoriaRepository)) },

  // agenda
  { provide: AgendaRepository, useClass: HttpAgendaRepository },
  { provide: ListAgenda, useFactory: () => new ListAgenda(inject(AgendaRepository)) },
  {
    provide: ListCancellationCandidates,
    useFactory: () => new ListCancellationCandidates(inject(AgendaRepository)),
  },
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
