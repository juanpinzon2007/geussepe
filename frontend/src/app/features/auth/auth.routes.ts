import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login-page.component').then((module) => module.LoginPageComponent),
  },
  {
    path: 'recover',
    loadComponent: () =>
      import('./recover-page.component').then((module) => module.RecoverPageComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
];
