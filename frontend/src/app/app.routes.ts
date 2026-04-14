import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/storefront/pages/home-page/home-page.component').then(
        (module) => module.HomePageComponent,
      ),
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./features/auth/auth.routes').then((module) => module.AUTH_ROUTES),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/app-shell.component').then(
        (module) => module.AppShellComponent,
      ),
    children: [
      {
        path: 'dashboard',
        data: { breadcrumb: 'Dashboard' },
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then(
            (module) => module.DashboardPageComponent,
          ),
      },
      {
        path: 'entity/:domain/:entity',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Gestión' },
        loadComponent: () =>
          import('./features/entity/entity-management-page.component').then(
            (module) => module.EntityManagementPageComponent,
          ),
      },
      {
        path: 'inventory/operations',
        canActivate: [permissionGuard],
        data: { permission: 'inventory.manage', breadcrumb: 'Operaciones inventario' },
        loadComponent: () =>
          import('./features/inventory/inventory-operations-page.component').then(
            (module) => module.InventoryOperationsPageComponent,
          ),
      },
      {
        path: 'purchases/operations',
        canActivate: [permissionGuard],
        data: { permission: 'purchases.manage', breadcrumb: 'Compras' },
        loadComponent: () =>
          import('./features/purchases/purchases-operations-page.component').then(
            (module) => module.PurchasesOperationsPageComponent,
          ),
      },
      {
        path: 'sales/operations',
        canActivate: [permissionGuard],
        data: { permission: 'sales.manage', breadcrumb: 'Ventas' },
        loadComponent: () =>
          import('./features/sales/sales-operations-page.component').then(
            (module) => module.SalesOperationsPageComponent,
          ),
      },
      {
        path: 'compliance/workbench',
        canActivate: [permissionGuard],
        data: { permission: 'compliance.manage', breadcrumb: 'Cumplimiento' },
        loadComponent: () =>
          import('./features/compliance/compliance-page.component').then(
            (module) => module.CompliancePageComponent,
          ),
      },
      {
        path: 'audit/workbench',
        canActivate: [permissionGuard],
        data: { permission: 'audit.read', breadcrumb: 'Auditoría' },
        loadComponent: () =>
          import('./features/audit/audit-page.component').then(
            (module) => module.AuditPageComponent,
          ),
      },
      {
        path: 'analytics',
        canActivate: [permissionGuard],
        data: { permission: 'reports.read', breadcrumb: 'Analítica' },
        loadComponent: () =>
          import('./features/analytics/analytics-page.component').then(
            (module) => module.AnalyticsPageComponent,
          ),
      },
      {
        path: 'reports',
        canActivate: [permissionGuard],
        data: { permission: 'reports.read', breadcrumb: 'Reportes' },
        loadComponent: () =>
          import('./features/reports/reports-page.component').then(
            (module) => module.ReportsPageComponent,
          ),
      },
      {
        path: 'ai',
        canActivate: [permissionGuard],
        data: { permission: 'ai.manage', breadcrumb: 'IA operativa' },
        loadComponent: () =>
          import('./features/ai/ai-page.component').then(
            (module) => module.AiPageComponent,
          ),
      },
      {
        path: 'integrations',
        canActivate: [permissionGuard],
        data: { permission: 'reports.read', breadcrumb: 'Integraciones' },
        loadComponent: () =>
          import('./features/integrations/integrations-page.component').then(
            (module) => module.IntegrationsPageComponent,
          ),
      },
      {
        path: 'profile',
        data: { breadcrumb: 'Mi perfil' },
        loadComponent: () =>
          import('./features/profile/profile-page.component').then(
            (module) => module.ProfilePageComponent,
          ),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
    ],
  },
  {
    path: 'access-denied',
    loadComponent: () =>
      import('./features/errors/access-denied-page.component').then(
        (module) => module.AccessDeniedPageComponent,
      ),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/errors/not-found-page.component').then(
        (module) => module.NotFoundPageComponent,
      ),
  },
];
