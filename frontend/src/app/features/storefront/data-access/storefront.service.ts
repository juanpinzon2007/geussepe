import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { environment } from '../../../../environments/environment';
import { StorefrontHomeResponse, StorefrontOrderPayload } from './storefront.models';

@Injectable({ providedIn: 'root' })
export class StorefrontService {
  private readonly api = inject(ApiService);
  private readonly apiOrigin = this.resolveApiOrigin();

  getHome() {
    return this.api
      .get<StorefrontHomeResponse>('/storefront/home')
      .pipe(map((response) => this.normalizeImageUrls(response)));
  }

  createOrder(payload: StorefrontOrderPayload) {
    return this.api.post<{ id_pedido_ecommerce: string; codigo_pedido: string }>(
      '/storefront/orders',
      payload,
    );
  }

  private normalizeImageUrls(response: StorefrontHomeResponse): StorefrontHomeResponse {
    const normalize = (imageUrl: string | null) => this.normalizeImageUrl(imageUrl);

    return {
      ...response,
      hero: {
        ...response.hero,
        products: response.hero.products.map((product) => ({
          ...product,
          image_url: normalize(product.image_url),
        })),
      },
      collections: response.collections.map((collection) => ({
        ...collection,
        image_url: normalize(collection.image_url),
      })),
      products: response.products.map((product) => ({
        ...product,
        image_url: normalize(product.image_url),
      })),
    };
  }

  private normalizeImageUrl(imageUrl: string | null) {
    if (!imageUrl) {
      return imageUrl;
    }

    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      try {
        const parsed = new URL(imageUrl);
        if (parsed.pathname.startsWith('/uploads/')) {
          return `${this.apiOrigin}${parsed.pathname}${parsed.search}`;
        }
      } catch {
        return imageUrl;
      }

      return imageUrl;
    }

    if (imageUrl.startsWith('/uploads/')) {
      return `${this.apiOrigin}${imageUrl}`;
    }

    return imageUrl;
  }

  private resolveApiOrigin() {
    try {
      return new URL(environment.apiBaseUrl, window.location.origin).origin;
    } catch {
      return window.location.origin;
    }
  }
}
