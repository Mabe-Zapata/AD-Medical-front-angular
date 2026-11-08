import { Routes } from '@angular/router';

import { PERMISSIONS } from './features/auth/domain/policies/staff-access';
import {
  anyPermissionGuard,
  authGuard,
  guestGuard,
  permissionGuard,
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
