import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { getEntityConfig } from '../config/entity.registry';
import { SessionStore } from '../services/session.store';

function resolvePermission(route: ActivatedRouteSnapshot) {
  if (route.data['permission']) {
    return route.data['permission'] as string;
  }

  const domain = route.paramMap.get('domain');
  const entity = route.paramMap.get('entity');
  if (domain && entity) {
    return getEntityConfig(domain, entity)?.permission;
  }

  return null;
}

export const permissionGuard: CanActivateFn = (route) => {
  const sessionStore = inject(SessionStore);
  const router = inject(Router);
  sessionStore.hydrate();

  if (sessionStore.hasPermission(resolvePermission(route))) {
    return true;
  }

  return router.createUrlTree(['/access-denied']);
};
