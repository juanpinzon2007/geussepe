import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SessionStore } from '../../core/services/session.store';
import { StatCardComponent } from '../../shared/ui/stat-card.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, MatButtonModule, RouterLink, StatCardComponent],
  template: `
    <section class="page-grid dashboard-page">
      <section class="dashboard-hero surface-card">
        <div class="dashboard-hero__copy">
          <span class="dashboard-hero__eyebrow">Centro de control</span>
          <h1>Cabina admin con lectura premium y accion rapida.</h1>
          <p>
            Supervisa inventario, ventas, compras y alertas desde una vista mas editorial,
            elegante y facil de recorrer durante la operacion diaria.
          </p>

          <div class="dashboard-hero__actions">
            <a mat-flat-button color="primary" routerLink="/app/reports">Abrir reportes</a>
            <a mat-stroked-button routerLink="/app/entity/masters/products">Ver catalogo</a>
          </div>
        </div>

        <div class="dashboard-hero__insights">
          <article class="hero-note">
            <span>Modo</span>
            <strong>{{ canReadAnalytics() ? 'Analitica activa' : 'Sesion operativa' }}</strong>
            <p>
              {{ canReadAnalytics()
                ? 'Tienes acceso a indicadores ejecutivos y alertas priorizadas.'
                : 'La navegacion sigue disponible segun los permisos de esta cuenta.' }}
            </p>
          </article>

          <article class="hero-note hero-note--light">
            <span>Alertas activas</span>
            <strong>{{ stockAlerts().length }}</strong>
            <p>Los eventos mas recientes de inventario quedan visibles en el tablero central.</p>
          </article>
        </div>
      </section>

      @if (canReadAnalytics()) {
        <section class="stats-grid">
          <app-stat-card
            label="Referencias con stock"
            [value]="dashboard()?.inventory?.referencias_con_stock ?? 0"
            helper="Inventario actual disponible"
          />
          <app-stat-card
            label="Unidades disponibles"
            [value]="dashboard()?.inventory?.unidades_disponibles ?? 0"
            helper="Disponible para operacion"
          />
          <app-stat-card
            label="Total vendido"
            [value]="(dashboard()?.sales?.total_vendido | currency: 'COP' : 'symbol-narrow' : '1.0-0') ?? '$0'"
            helper="Ventas registradas en el periodo"
          />
          <app-stat-card
            label="Total comprado"
            [value]="(dashboard()?.purchases?.total_comprado | currency: 'COP' : 'symbol-narrow' : '1.0-0') ?? '$0'"
            helper="Ordenes y compras aprobadas"
          />
        </section>

        <section class="grid-two">
          <article class="surface-card block block--alerts">
            <div class="block__header">
              <div class="block__header-copy">
                <span class="block__eyebrow">Radar operativo</span>
                <h2 class="section-title">Alertas de stock</h2>
                <p class="muted">
                  Referencias con movimientos que necesitan atencion inmediata en bodega.
                </p>
              </div>
              <span class="badge">{{ stockAlerts().length }} alertas</span>
            </div>

            <div class="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Bodega</th>
                    <th>Disponible</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of stockAlerts(); track item.id_producto + item.id_bodega) {
                    <tr>
                      <td>{{ item.nombre_producto }}</td>
                      <td>{{ item.nombre_bodega }}</td>
                      <td>{{ item.cantidad_disponible | number: '1.0-2' }}</td>
                      <td>
                        <span
                          class="status-chip"
                          [class.warning]="item.tipo_alerta === 'STOCK_BAJO'"
                          [class.danger]="item.tipo_alerta === 'SOBRESTOCK'"
                        >
                          {{ item.tipo_alerta }}
                        </span>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="empty-state">No hay alertas activas.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </article>

          <article class="surface-card block block--links">
            <div class="block__header">
              <div class="block__header-copy">
                <span class="block__eyebrow">Atajos curados</span>
                <h2 class="section-title">Rutas rapidas</h2>
                <p class="muted">Accesos directos a los modulos de trabajo mas usados por admin.</p>
              </div>
            </div>

            <div class="quick-links">
              <a routerLink="/app/entity/masters/products" class="quick-link">
                <span class="quick-link__title">Productos</span>
                <span class="quick-link__meta">Catalogo, fichas maestras y actualizacion comercial.</span>
              </a>
              <a routerLink="/app/inventory/operations" class="quick-link">
                <span class="quick-link__title">Inventario</span>
                <span class="quick-link__meta">Entradas, traslados y control de existencias.</span>
              </a>
              <a routerLink="/app/purchases/operations" class="quick-link">
                <span class="quick-link__title">Compras</span>
                <span class="quick-link__meta">Ordenes, abastecimiento y recepcion operativa.</span>
              </a>
              <a routerLink="/app/sales/operations" class="quick-link">
                <span class="quick-link__title">Ventas</span>
                <span class="quick-link__meta">Facturacion, cierre comercial y seguimiento.</span>
              </a>
              <a routerLink="/app/compliance/workbench" class="quick-link">
                <span class="quick-link__title">Cumplimiento</span>
                <span class="quick-link__meta">Validaciones, trazabilidad y controles internos.</span>
              </a>
              <a routerLink="/app/ai" class="quick-link">
                <span class="quick-link__title">IA operativa</span>
                <span class="quick-link__meta">Asistencia automatizada para decisiones y soporte.</span>
              </a>
            </div>
          </article>
        </section>
      } @else {
        <article class="surface-card block">
          <h2 class="section-title">Sesion activa</h2>
          <p class="muted">
            La cuenta actual no tiene permiso reports.read. La navegacion sigue disponible segun
            los permisos del usuario autenticado.
          </p>
        </article>
      }
    </section>
  `,
  styles: `
    .dashboard-page {
      animation: dashboard-enter 260ms ease;
    }

    .dashboard-hero {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.95fr);
      gap: 1.25rem;
      padding: clamp(1.4rem, 3vw, 2rem);
      overflow: hidden;
      background:
        radial-gradient(circle at top right, rgba(200, 163, 108, 0.22), transparent 24%),
        radial-gradient(circle at left center, rgba(122, 24, 48, 0.14), transparent 24%),
        linear-gradient(135deg, rgba(255, 251, 247, 0.98), rgba(247, 235, 226, 0.96));
    }

    .dashboard-hero__copy {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 0.9rem;
      align-content: start;
    }

    .dashboard-hero__eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      color: var(--color-admin-burgundy);
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .dashboard-hero__eyebrow::before {
      content: '';
      width: 3rem;
      height: 1px;
      background: linear-gradient(90deg, var(--color-admin-burgundy), var(--color-admin-gold));
    }

    .dashboard-hero h1 {
      margin: 0;
      max-width: 14ch;
      font-family: var(--font-admin-display);
      font-size: clamp(3rem, 5vw, 4.8rem);
      font-weight: 700;
      line-height: 0.92;
      letter-spacing: -0.04em;
      color: var(--color-admin-ink);
    }

    .dashboard-hero p {
      max-width: 42rem;
      margin: 0;
      color: var(--color-admin-ink-soft);
      line-height: 1.7;
    }

    .dashboard-hero__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 0.2rem;
    }

    .dashboard-hero__insights {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 0.85rem;
      align-content: stretch;
    }

    .hero-note {
      display: grid;
      gap: 0.45rem;
      padding: 1.15rem 1.2rem;
      border-radius: 24px;
      background: linear-gradient(155deg, rgba(67, 10, 24, 0.96), rgba(122, 24, 48, 0.92));
      border: 1px solid rgba(200, 163, 108, 0.2);
      color: #fff7f2;
      box-shadow: 0 20px 36px rgba(43, 11, 19, 0.18);
    }

    .hero-note--light {
      background: linear-gradient(180deg, rgba(255, 248, 241, 0.96), rgba(248, 237, 228, 0.96));
      color: var(--color-admin-ink);
    }

    .hero-note span {
      color: inherit;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.82;
    }

    .hero-note strong {
      font-family: var(--font-admin-display);
      font-size: clamp(1.8rem, 3vw, 2.4rem);
      font-weight: 700;
      line-height: 0.96;
      letter-spacing: -0.03em;
    }

    .hero-note p {
      color: inherit;
      opacity: 0.8;
      font-size: 0.92rem;
      line-height: 1.6;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .grid-two {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.9fr);
      gap: 1rem;
    }

    .block {
      padding: 1.25rem;
    }

    .block__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .block__header-copy {
      display: grid;
      gap: 0.3rem;
    }

    .block__header-copy p {
      margin: 0;
      max-width: 34rem;
      line-height: 1.6;
    }

    .block__eyebrow {
      color: var(--color-admin-burgundy);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .block--alerts table {
      min-width: 560px;
    }

    .block--alerts tbody tr:hover {
      background: rgba(122, 24, 48, 0.04);
    }

    .quick-links {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.85rem;
    }

    .quick-link {
      display: grid;
      gap: 0.45rem;
      padding: 1.1rem;
      border-radius: 20px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(252, 245, 239, 0.92));
      border: 1px solid rgba(122, 24, 48, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
    }

    .quick-link:hover {
      transform: translateY(-4px);
      border-color: rgba(200, 163, 108, 0.36);
      box-shadow: 0 18px 30px rgba(67, 10, 24, 0.12);
    }

    .quick-link__title {
      font-family: var(--font-admin-display);
      font-size: 1.28rem;
      font-weight: 700;
      line-height: 1;
      color: var(--color-admin-ink);
    }

    .quick-link__meta {
      color: var(--color-admin-ink-soft);
      font-size: 0.9rem;
      line-height: 1.55;
    }

    @keyframes dashboard-enter {
      from {
        opacity: 0;
        transform: translateY(10px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 1024px) {
      .dashboard-hero {
        grid-template-columns: 1fr;
      }

      .grid-two {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .dashboard-hero h1 {
        max-width: none;
      }

      .quick-links {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent {
  private readonly api = inject(ApiService);
  private readonly sessionStore = inject(SessionStore);

  readonly dashboard = signal<any | null>(null);
  readonly stockAlerts = signal<any[]>([]);

  constructor() {
    if (this.canReadAnalytics()) {
      this.api.get('/analytics/dashboard').subscribe((response) => this.dashboard.set(response));
      this.api
        .get<any[]>('/analytics/stock-alerts')
        .subscribe((response) => this.stockAlerts.set(response.slice(0, 10)));
    }
  }

  canReadAnalytics() {
    return this.sessionStore.hasPermission('reports.read');
  }
}
