import { computed, Injectable, signal } from '@angular/core';
import { CartItem, StorefrontProduct } from './storefront.models';

const CART_STORAGE_KEY = 'arle.storefront.cart';

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly itemsState = signal<CartItem[]>([]);
  private hydrated = false;

  readonly items = computed(() => this.itemsState());
  readonly count = computed(() =>
    this.itemsState().reduce((total, item) => total + item.quantity, 0),
  );
  readonly subtotal = computed(() =>
    this.itemsState().reduce(
      (total, item) => total + item.product.price * item.quantity,
      0,
    ),
  );

  hydrate() {
    if (this.hydrated) {
      return;
    }

    this.hydrated = true;

    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (!stored) {
        return;
      }

      this.itemsState.set(JSON.parse(stored) as CartItem[]);
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }

  addProduct(product: StorefrontProduct, quantity = 1) {
    const items = [...this.itemsState()];
    const existing = items.find((item) => item.product.id === product.id);

    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ product, quantity });
    }

    this.persist(items);
  }

  updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      this.removeProduct(productId);
      return;
    }

    const items = this.itemsState().map((item) =>
      item.product.id === productId ? { ...item, quantity } : item,
    );
    this.persist(items);
  }

  removeProduct(productId: string) {
    this.persist(this.itemsState().filter((item) => item.product.id !== productId));
  }

  clear() {
    this.persist([]);
  }

  private persist(items: CartItem[]) {
    this.itemsState.set(items);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }
}
