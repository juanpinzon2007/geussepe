export interface StorefrontBrand {
  name: string;
  subtitle: string;
}

export interface StorefrontProduct {
  id: string;
  title: string;
  full_name: string;
  description: string;
  category_id: string | null;
  category_name: string;
  product_type: string;
  image_url: string | null;
  price: number;
  stock_available: number;
}

export interface StorefrontHero {
  title: string;
  subtitle: string;
  button_text: string;
  products: StorefrontProduct[];
}

export interface StorefrontCollection {
  id: string;
  title: string;
  subtitle: string;
  total_products: number;
  lead_product_id: string | null;
  lead_product_name: string | null;
  image_url: string | null;
  tone: 'rose' | 'mint' | 'lavender' | 'pearl';
}

export interface StorefrontPromo {
  label: string;
  helper: string;
  description: string;
  url: string;
}

export interface StorefrontSupport {
  help_text: string;
  whatsapp_url: string;
}

export interface StorefrontHomeResponse {
  brand: StorefrontBrand;
  hero: StorefrontHero;
  collections: StorefrontCollection[];
  products: StorefrontProduct[];
  promo: StorefrontPromo;
  support: StorefrontSupport;
}

export interface CartItem {
  product: StorefrontProduct;
  quantity: number;
}

export interface StorefrontOrderPayload {
  nombre_cliente: string;
  correo_cliente: string;
  telefono_cliente: string;
  ciudad_cliente: string;
  observaciones?: string;
  referencia_externa?: string;
  costo_envio?: number;
  detalles: Array<{
    id_producto: string;
    cantidad: number;
    precio_unitario: number;
  }>;
}
