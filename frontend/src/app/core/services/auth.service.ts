import { inject, Injectable } from '@angular/core';
import { finalize, tap } from 'rxjs';
import { AuthResponse } from '../models/app.models';
import { ApiService } from './api.service';
import { SessionStore } from './session.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly sessionStore = inject(SessionStore);

  login(payload: { username: string; password: string }) {
    return this.api.post<AuthResponse>('/auth/login', payload).pipe(
      tap((response) => {
        this.sessionStore.setSession(response.access_token, response.user);
      }),
    );
  }

  me() {
    return this.api.get<AuthResponse['user']>('/auth/me').pipe(
      tap((user) => {
        this.sessionStore.updateUser(user);
      }),
    );
  }

  logout() {
    return this.api.post('/auth/logout', {}).pipe(
      finalize(() => {
        this.sessionStore.clearSession();
      }),
    );
  }

  recoverRequest(identifier: string) {
    return this.api.post('/auth/password/recover-request', { identifier });
  }

  recoverConfirm(payload: { token: string; new_password: string }) {
    return this.api.post('/auth/password/recover-confirm', payload);
  }

  changePassword(payload: { current_password: string; new_password: string }) {
    return this.api.post('/auth/password/change', payload);
  }
}
