import { Routes } from '@angular/router';

import { PERMISSIONS } from './features/auth/domain/policies/staff-access';
import {
  anyPermissionGuard,
  authGuard,
  guestGuard,
  permissionGuard,
  roleGuard,
} from './features/auth/presentation/guards';
import { StaffShell } from './shell/staff-shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Iniciar sesión · Medilo',
    loadComponent: () =>
      import('./features/auth/presentation/pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: StaffShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio · Medilo',
        loadComponent: () =>
          import('./features/home/presentation/home.page').then((m) => m.HomePage),
      },
      {
        path: 'agenda',
        title: 'Agenda del médico · Medilo',
        canActivate: [roleGuard('MEDICO')],
        loadComponent: () =>
          import('./features/agenda/presentation/pages/agenda.page').then((m) => m.AgendaPage),
      },
      {
        path: 'agenda/aprobaciones',
        title: 'Aprobación de cancelaciones · Medilo',
        canActivate: [permissionGuard(PERMISSIONS.cancellationApprovalsReview)],
        loadComponent: () =>
          import('./features/agenda/presentation/pages/cancellation-approval.page').then(
            (m) => m.CancellationApprovalPage,
          ),
      },
      {
        path: 'ordenes',
        title: 'Órdenes y resultados · Medilo',
        canActivate: [
          anyPermissionGuard(
            PERMISSIONS.ordersCreate,
            PERMISSIONS.resultsRecord,
            PERMISSIONS.resultsReadWithAccess,
            PERMISSIONS.reviewsRecord,
          ),
        ],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/orders/presentation/pages/orders.page').then((m) => m.OrdersPage),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/orders/presentation/pages/order-detail.page').then(
                (m) => m.OrderDetailPage,
              ),
          },
        ],
      },
      {
        path: 'mi-horario',
        title: 'Mi horario de atención · Medilo',
        canActivate: [roleGuard('MEDICO')],
        loadComponent: () =>
          import('./features/horarios/presentation/pages/my-work-hours.page').then(
            (m) => m.MyWorkHoursPage,
          ),
      },
      {
        path: 'planificacion',
        title: 'Planificación semanal · Medilo',
        canActivate: [permissionGuard(PERMISSIONS.slotsGenerate)],
        loadComponent: () =>
          import('./features/horarios/presentation/pages/weekly-planning.page').then(
            (m) => m.WeeklyPlanningPage,
          ),
      },
      {
        path: 'reportes',
        title: 'Reportes · Medilo',
        canActivate: [permissionGuard(PERMISSIONS.reportsRead)],
        loadComponent: () =>
          import('./features/reports/presentation/pages/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'monitoreo',
        title: 'Monitoreo · Medilo',
        canActivate: [permissionGuard(PERMISSIONS.monitoringRead)],
        loadComponent: () =>
          import('./features/reports/presentation/pages/monitoring.page').then(
            (m) => m.MonitoringPage,
          ),
      },
      {
        path: 'usuarios',
        title: 'Usuarios y roles · Medilo',
        canActivate: [permissionGuard(PERMISSIONS.usersAdmin)],
        loadComponent: () =>
          import('./features/users/presentation/pages/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'sedes',
        title: 'Sucursales y consultorios · Medilo',
        canActivate: [permissionGuard(PERMISSIONS.sedesAdmin)],
        loadComponent: () =>
          import('./features/sedes/presentation/pages/sedes.page').then((m) => m.SedesPage),
      },
      {
        path: 'historia',
        title: 'Historia clínica · Medilo',
        canActivate: [permissionGuard(PERMISSIONS.historyRead)],
        loadComponent: () =>
          import('./features/historia/presentation/pages/historia.page').then((m) => m.HistoriaPageComponent),
      },
      {
        path: 'conocimiento',
        title: 'Conocimiento clínico · Medilo',
        canActivate: [permissionGuard(PERMISSIONS.knowledgeRead)],
        loadChildren: () =>
          import('./features/knowledge/knowledge.routes').then((m) => m.knowledgeRoutes),
      },
    ],
  },
  { path: '**', redirectTo: 'inicio' },
];
