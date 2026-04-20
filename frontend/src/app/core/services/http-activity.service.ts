import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HttpActivityService {
  private readonly pendingRequests = signal(0);

  readonly isLoading = computed(() => this.pendingRequests() > 0);

  increment() {
    this.pendingRequests.update((count) => count + 1);
  }

  decrement() {
    this.pendingRequests.update((count) => Math.max(0, count - 1));
  }
}
