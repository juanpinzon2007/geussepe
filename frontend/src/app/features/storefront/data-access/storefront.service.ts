import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { StorefrontHomeResponse, StorefrontOrderPayload } from './storefront.models';

@Injectable({ providedIn: 'root' })
export class StorefrontService {
  private readonly api = inject(ApiService);

  getHome() {
    return this.api.get<StorefrontHomeResponse>('/storefront/home');
  }

  createOrder(payload: StorefrontOrderPayload) {
    return this.api.post<{ id_pedido_ecommerce: string; codigo_pedido: string }>(
      '/storefront/orders',
      payload,
    );
  }
}
