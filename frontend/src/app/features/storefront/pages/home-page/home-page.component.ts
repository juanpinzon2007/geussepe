import { CommonModule, CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { SessionStore } from '../../../../core/services/session.store';
import { CartStore } from '../../data-access/cart.store';
import {
  StorefrontCollection,
  StorefrontHomeResponse,
  StorefrontProduct,
} from '../../data-access/storefront.models';
import { StorefrontService } from '../../data-access/storefront.service';
import { FeaturedCollectionsComponent } from '../../components/featured-collections/featured-collections.component';
import { FloatingButtonsComponent } from '../../components/floating-buttons/floating-buttons.component';
import { HeaderComponent } from '../../components/header/header.component';
import { HeroBannerComponent } from '../../components/hero-banner/hero-banner.component';
import {
  STOREFRONT_CATALOG_SECTIONS as STOREFRONT_CATALOG_SECTIONS_DATA,
  STOREFRONT_TECHNICAL_ATTRIBUTES as STOREFRONT_TECHNICAL_ATTRIBUTES_DATA,
} from '../../data-access/storefront-curation.data';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    HeaderComponent,
    HeroBannerComponent,
    FeaturedCollectionsComponent,
    FloatingButtonsComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  private readonly storefrontService = inject(StorefrontService);
  private readonly cartStore = inject(CartStore);
  private readonly sessionStore = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly home = signal<StorefrontHomeResponse | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly menuOpen = signal(false);
  readonly searchOpen = signal(false);
  readonly cartOpen = signal(false);
  readonly selectedCollectionId = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly orderCode = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly items = this.cartStore.items;
  readonly cartCount = this.cartStore.count;
  readonly cartSubtotal = this.cartStore.subtotal;
  readonly isAuthenticated = this.sessionStore.isAuthenticated;
  readonly catalogSections = STOREFRONT_CATALOG_SECTIONS_DATA;
  readonly technicalAttributes = STOREFRONT_TECHNICAL_ATTRIBUTES_DATA;
  readonly products = computed(() => this.home()?.products ?? []);
  readonly activeCollection = computed(
    () =>
      this.home()?.collections.find((collection) => collection.id === this.selectedCollectionId()) ?? null,
  );
  readonly filteredProductCount = computed(() => this.filteredProducts().length);
  readonly filteredProducts = computed(() => {
    const collectionId = this.selectedCollectionId();
    const term = this.searchTerm().trim().toLowerCase();

    return this.products().filter((product) => {
      const matchCollection = !collectionId || product.category_id === collectionId;
      const matchTerm =
        !term ||
        product.title.toLowerCase().includes(term) ||
        product.category_name.toLowerCase().includes(term) ||
        product.full_name.toLowerCase().includes(term);

      return matchCollection && matchTerm;
    });
  });

  readonly checkoutForm = this.formBuilder.nonNullable.group({
    nombre_cliente: ['', [Validators.required, Validators.minLength(3)]],
    correo_cliente: ['', [Validators.required, Validators.email]],
    telefono_cliente: ['', [Validators.required, Validators.minLength(7)]],
    ciudad_cliente: ['', [Validators.required, Validators.minLength(3)]],
    observaciones: [''],
  });

  constructor() {
    this.cartStore.hydrate();
    this.sessionStore.hydrate();
    this.loadHome();
  }

  loadHome() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.storefrontService
      .getHome()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.home.set(response);
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set(
            'No fue posible cargar el catalogo. Verifica la API y vuelve a intentar.',
          );
          this.loading.set(false);
        },
      });
  }

  toggleMenu() {
    this.menuOpen.update((value) => !value);
    this.searchOpen.set(false);
  }

  openSearch() {
    this.searchOpen.set(true);
    this.menuOpen.set(false);
  }

  closePanels() {
    this.menuOpen.set(false);
    this.searchOpen.set(false);
  }

  openCart() {
    this.closePanels();
    this.cartOpen.set(true);
    this.orderCode.set(null);
  }

  closeCart() {
    this.cartOpen.set(false);
  }

  goToAccount() {
    void this.router.navigateByUrl(this.isAuthenticated() ? '/app/profile' : '/auth/login');
  }

  goToDashboard() {
    void this.router.navigateByUrl(this.isAuthenticated() ? '/app/dashboard' : '/auth/login');
  }

  updateSearch(term: string) {
    this.searchTerm.set(term);
  }

  clearCollectionFilter() {
    this.selectedCollectionId.set(null);
  }

  selectCollection(collection: StorefrontCollection) {
    this.selectedCollectionId.set(collection.id);
    this.closePanels();
    document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  addProduct(product: StorefrontProduct) {
    this.cartStore.addProduct(product);
    this.cartOpen.set(true);
  }

  addHeroBundle() {
    for (const product of this.home()?.hero.products.slice(0, 2) ?? []) {
      this.cartStore.addProduct(product);
    }

    this.cartOpen.set(true);
  }

  changeQuantity(productId: string, nextQuantity: number) {
    this.cartStore.updateQuantity(productId, nextQuantity);
  }

  removeItem(productId: string) {
    this.cartStore.removeProduct(productId);
  }

  submitOrder() {
    if (this.checkoutForm.invalid || !this.items().length) {
      this.checkoutForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.checkoutForm.getRawValue();

    this.storefrontService
      .createOrder({
        ...raw,
        costo_envio: 0,
        referencia_externa: raw.correo_cliente,
        detalles: this.items().map((item) => ({
          id_producto: item.product.id,
          cantidad: item.quantity,
          precio_unitario: item.product.price,
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.orderCode.set(response.codigo_pedido);
          this.cartStore.clear();
          this.checkoutForm.reset({
            nombre_cliente: '',
            correo_cliente: '',
            telefono_cliente: '',
            ciudad_cliente: '',
            observaciones: '',
          });
          this.submitting.set(false);
        },
        error: () => {
          this.errorMessage.set(
            'No fue posible crear el pedido. Revisa los datos y valida la conexion con el backend.',
          );
          this.submitting.set(false);
        },
      });
  }

  trackByProduct(index: number, product: StorefrontProduct) {
    return product.id || index;
  }

  resolveProductImage(product: StorefrontProduct) {
    return this.api.resolveAssetUrl(product.image_url);
  }

  onProductImageError(event: Event, product: StorefrontProduct) {
    const img = event.target as HTMLImageElement | null;
    if (!img) {
      return;
    }

    const originalPath = product.image_url ?? '';
    const currentSrc = img.getAttribute('src') ?? '';
    const resolvedPath = this.api.resolveAssetUrl(originalPath);

    if (resolvedPath && currentSrc !== resolvedPath) {
      img.src = resolvedPath;
      return;
    }

    if (originalPath && currentSrc !== originalPath) {
      img.src = originalPath;
      return;
    }

    img.onerror = null;
    img.src = '/assets/store/catalog/obsidian-glow.svg';
  }
}
