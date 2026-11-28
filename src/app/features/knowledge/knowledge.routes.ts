import { Routes } from '@angular/router';

import { anyPermissionGuard, permissionGuard } from '../auth/presentation/guards';
import { PERMISSIONS } from '../auth/domain/policies/staff-access';
import { KnowledgeLayout } from './presentation/knowledge.layout';

export const knowledgeRoutes: Routes = [
  {
    path: '',
    component: KnowledgeLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'analitos' },
      {
        path: 'analitos',
        loadComponent: () =>
          import('./presentation/pages/analytes.page').then((m) => m.AnalytesPage),
      },
      {
        path: 'analitos/:id',
        loadComponent: () =>
          import('./presentation/pages/analyte-detail.page').then((m) => m.AnalyteDetailPage),
      },
      {
        path: 'reglas',
        canActivate: [permissionGuard(PERMISSIONS.knowledgeAdmin)],
        loadComponent: () => import('./presentation/pages/rules.page').then((m) => m.RulesPage),
      },
      {
        path: 'revision',
        canActivate: [anyPermissionGuard(PERMISSIONS.knowledgeValidate, PERMISSIONS.knowledgeAdmin)],
        loadComponent: () => import('./presentation/pages/review.page').then((m) => m.ReviewPage),
      },
      {
        path: 'borradores',
        canActivate: [anyPermissionGuard(PERMISSIONS.knowledgeValidate, PERMISSIONS.knowledgeAdmin)],
        loadComponent: () => import('./presentation/pages/drafts.page').then((m) => m.DraftsPage),
      },
    ],
  },
];
