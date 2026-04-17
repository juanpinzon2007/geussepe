import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { retry, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiQueryParams } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

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
