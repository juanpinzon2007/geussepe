import { computed, Injectable, signal } from '@angular/core';
import { AuthUser, SessionState } from '../models/app.models';

const STORAGE_KEY = 'arle.session';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly state = signal<SessionState>({
    token: null,
    user: null,
    hydrated: false,
  });

  readonly token = computed(() => this.state().token);
  readonly user = computed(() => this.state().user);
  readonly hydrated = computed(() => this.state().hydrated);
  readonly isAuthenticated = computed(
    () => Boolean(this.state().token && this.state().user),
  );

  hydrate() {
    if (this.state().hydrated) {
      return;
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Pick<SessionState, 'token' | 'user'>;
        this.state.set({
          token: parsed.token,
          user: parsed.user,
          hydrated: true,
        });
        return;
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }

    this.state.update((current) => ({ ...current, hydrated: true }));
  }

  setSession(token: string, user: AuthUser) {
    const nextState: SessionState = {
      token,
      user,
      hydrated: true,
    };
    this.state.set(nextState);
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: nextState.token, user: nextState.user }),
    );
  }

  updateUser(user: AuthUser) {
    this.state.update((current) => ({ ...current, user }));
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: this.state().token, user }),
    );
  }

  clearSession() {
    this.state.set({
      token: null,
      user: null,
      hydrated: true,
    });
    sessionStorage.removeItem(STORAGE_KEY);
  }

  hasPermission(permission?: string | null) {
    if (!permission) {
      return true;
    }

    const user = this.user();
    return Boolean(
      user &&
        (user.roles.includes('ADMINISTRADOR') ||
          user.permissions.includes(permission)),
    );
  }
}
