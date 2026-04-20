import { environment } from '../../../../environments/environment';
import type { StorefrontHomeResponse } from '../data-access/storefront.models';

/**
 * En desarrollo la SPA corre en otro puerto que la API; las rutas `/uploads/*`
 * deben apuntar al origen del backend. En producción con `apiBaseUrl` relativo
 * (`/api/v1`) se mantiene la ruta y el mismo host debe servir `/uploads`.
 */
export function resolveStorefrontImageUrl(url: string | null | undefined): string | null {
  if (url == null || url === '') {
    return null;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/uploads/')) {
    const apiBase = environment.apiBaseUrl;
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      const origin = apiBase.replace(/\/api\/v1\/?$/, '');
      return `${origin}${url}`;
    }
  }
  return url;
}

export function withResolvedStorefrontImages(home: StorefrontHomeResponse): StorefrontHomeResponse {
  return {
    ...home,
    hero: {
      ...home.hero,
      products: home.hero.products.map((product) => ({
        ...product,
        image_url: resolveStorefrontImageUrl(product.image_url),
      })),
    },
    collections: home.collections.map((collection) => ({
      ...collection,
      image_url: resolveStorefrontImageUrl(collection.image_url),
    })),
    products: home.products.map((product) => ({
      ...product,
      image_url: resolveStorefrontImageUrl(product.image_url),
    })),
  };
}
