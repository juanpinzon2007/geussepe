import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { retry, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiQueryParams } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly apiOrigin = this.resolveApiOrigin();
  private readonly appOrigin = this.resolveAppOrigin();

  get<T>(path: string, query?: ApiQueryParams) {
    return this.http
      .get<T>(`${this.baseUrl}${path}`, { params: this.toHttpParams(query) })
      .pipe(retry({ count: 1, delay: 250 }), timeout(15000));
  }

  post<T>(path: string, payload?: unknown) {
    return this.http
      .post<T>(`${this.baseUrl}${path}`, payload ?? {})
      .pipe(timeout(15000));
  }

  upload<T>(path: string, payload: FormData) {
    return this.http
      .post<T>(`${this.baseUrl}${path}`, payload)
      .pipe(timeout(30000));
  }

  patch<T>(path: string, payload: unknown) {
    return this.http
      .patch<T>(`${this.baseUrl}${path}`, payload)
      .pipe(timeout(15000));
  }

  resolveAssetUrl(value: string | null | undefined) {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    if (trimmedValue.startsWith('/uploads/')) {
      return `${this.apiOrigin}${trimmedValue}`;
    }

    if (trimmedValue.startsWith('/assets/')) {
      return `${this.appOrigin}${trimmedValue}`;
    }

    if (trimmedValue.startsWith('/')) {
      return `${this.appOrigin}${trimmedValue}`;
    }

    if (trimmedValue.startsWith('uploads/')) {
      return `${this.apiOrigin}/${trimmedValue}`;
    }

    try {
      const parsedUrl = new URL(trimmedValue);
      if (parsedUrl.pathname.startsWith('/uploads/')) {
        return `${this.apiOrigin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      }

      if (parsedUrl.pathname.startsWith('/assets/')) {
        return `${this.appOrigin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      }

      return parsedUrl.toString();
    } catch {
      return `${this.appOrigin}/${trimmedValue.replace(/^\/+/, '')}`;
    }
  }

  private resolveApiOrigin() {
    try {
      return new URL(this.baseUrl, this.resolveAppOrigin()).origin;
    } catch {
      return 'http://localhost';
    }
  }

  private resolveAppOrigin() {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }

    return 'http://localhost';
  }

  private toHttpParams(query?: ApiQueryParams) {
    let params = new HttpParams();
    if (!query) {
      return params;
    }

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return params;
  }
}
