import { Routes } from '@angular/router';

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
        loadComponent: () => import('./presentation/pages/rules.page').then((m) => m.RulesPage),
      },
      {
        path: 'revision',
        loadComponent: () => import('./presentation/pages/review.page').then((m) => m.ReviewPage),
      },
      {
        path: 'borradores',
        loadComponent: () => import('./presentation/pages/drafts.page').then((m) => m.DraftsPage),
      },
    ],
  },
];
