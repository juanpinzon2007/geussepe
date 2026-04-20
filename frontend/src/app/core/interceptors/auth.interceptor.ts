import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from '../services/session.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionStore = inject(SessionStore);
  sessionStore.hydrate();

  const token = sessionStore.token();
  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
