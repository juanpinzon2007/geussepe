import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SessionStore } from '../../core/services/session.store';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { StatCardComponent } from '../../shared/ui/stat-card.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    CommonModule,
    MatButtonModule,
    PageHeaderComponent,
    RouterLink,
    StatCardComponent,
  ],
  template: `
    <section class="page-grid">
      <app-page-header
        title="Dashboard administrativo"
        subtitle="Vista ejecutiva del estado operativo del backend, con métricas de inventario, compras, ventas y alertas."
        eyebrow="Centro de control"
      >
        <a mat-flat-button color="primary" routerLink="/app/reports">Abrir reportes</a>
      </app-page-header>

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
            helper="Disponible para operación"
          />
          <app-stat-card
            label="Total vendido"
            [value]="(dashboard()?.sales?.total_vendido | currency: 'COP' : 'symbol-narrow' : '1.0-0') ?? '$0'"
            helper="Ventas registradas en el período"
          />
          <app-stat-card
            label="Total comprado"
            [value]="(dashboard()?.purchases?.total_comprado | currency: 'COP' : 'symbol-narrow' : '1.0-0') ?? '$0'"
            helper="Órdenes y compras aprobadas"
          />
        </section>

        <section class="grid-two">
          <article class="surface-card block">
            <div class="block__header">
              <h2 class="section-title">Alertas de stock</h2>
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

          <article class="surface-card block">
            <div class="block__header">
              <h2 class="section-title">Rutas rápidas</h2>
            </div>

            <div class="quick-links">
              <a routerLink="/app/entity/masters/products" class="quick-link">
                Productos
              </a>
              <a routerLink="/app/inventory/operations" class="quick-link">
                Inventario
              </a>
              <a routerLink="/app/purchases/operations" class="quick-link">
                Compras
              </a>
              <a routerLink="/app/sales/operations" class="quick-link">
                Ventas
              </a>
              <a routerLink="/app/compliance/workbench" class="quick-link">
                Cumplimiento
              </a>
              <a routerLink="/app/ai" class="quick-link">
                IA operativa
              </a>
            </div>
          </article>
        </section>
      } @else {
        <article class="surface-card block">
          <h2 class="section-title">Sesión activa</h2>
          <p class="muted">
            La cuenta actual no tiene permiso reports.read. La navegación sigue
            disponible según los permisos del usuario autenticado.
          </p>
        </article>
      }
    </section>
  `,
  styles: `
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
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .quick-links {
      display: grid;
      gap: 0.75rem;
    }

    .quick-link {
      padding: 1rem;
      border-radius: 14px;
      background: var(--color-surface-strong);
      border: 1px solid rgba(213, 224, 234, 0.92);
      font-weight: 600;
    }

    @media (max-width: 1024px) {
      .grid-two {
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
