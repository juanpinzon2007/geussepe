import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionStore } from '../services/session.store';
import { UiFeedbackService } from '../services/ui-feedback.service';

function resolveMessage(error: HttpErrorResponse) {
  if (typeof error.error === 'string') {
    return error.error;
  }

  if (error.error?.message) {
    return Array.isArray(error.error.message)
      ? error.error.message.join(', ')
      : error.error.message;
  }

  if (error.status === 0) {
    return 'No fue posible conectar con el backend.';
  }

  return 'La solicitud no pudo completarse.';
}

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const uiFeedback = inject(UiFeedbackService);
  const sessionStore = inject(SessionStore);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        sessionStore.clearSession();
        router.navigate(['/auth/login']);
      }

      uiFeedback.error(resolveMessage(error));
      return throwError(() => error);
    }),
  );
};
