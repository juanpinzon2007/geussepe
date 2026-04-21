import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  StorefrontCollection,
  StorefrontHomeResponse,
  StorefrontOrderPayload,
  StorefrontProduct,
} from './storefront.models';

@Injectable({ providedIn: 'root' })
export class StorefrontService {
  private readonly api = inject(ApiService);

  getHome() {
    return this.api.get<StorefrontHomeResponse>('/storefront/home').pipe(
      map((response) => ({
        ...response,
        hero: {
          ...response.hero,
          products: response.hero.products.map((product) => this.mapProduct(product)),
        },
        collections: response.collections.map((collection) => this.mapCollection(collection)),
        products: response.products.map((product) => this.mapProduct(product)),
      })),
    );
  }

  createOrder(payload: StorefrontOrderPayload) {
    return this.api.post<{ id_pedido_ecommerce: string; codigo_pedido: string }>(
      '/storefront/orders',
      payload,
    );
  }

  private mapProduct(product: StorefrontProduct): StorefrontProduct {
    return {
      ...product,
      image_url: this.api.resolveAssetUrl(product.image_url),
    };
  }

  private mapCollection(collection: StorefrontCollection): StorefrontCollection {
    return {
      ...collection,
      image_url: this.api.resolveAssetUrl(collection.image_url),
    };
  }
}
