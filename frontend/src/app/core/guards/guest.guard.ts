import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../services/session.store';

export const guestGuard: CanActivateFn = () => {
  const sessionStore = inject(SessionStore);
  const router = inject(Router);
  sessionStore.hydrate();

  if (sessionStore.isAuthenticated()) {
    const user = sessionStore.user();
    const hasBackofficeAccess = Boolean(user?.permissions?.length || user?.roles?.length);
    return router.createUrlTree([hasBackofficeAccess ? '/app/dashboard' : '/home']);
  }

  return true;
};
