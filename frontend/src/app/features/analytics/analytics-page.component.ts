import { CommonModule, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/services/api.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { StatCardComponent } from '../../shared/ui/stat-card.component';

@Component({
  selector: 'app-analytics-page',
  imports: [CommonModule, JsonPipe, MatButtonModule, PageHeaderComponent, StatCardComponent],
  template: `
    <section class="page-grid">
      <app-page-header
        title="Analítica y alertas"
        subtitle="KPI operativos, rotación y alertas de stock expuestos por el backend."
        eyebrow="Analítica"
      >
        <button mat-flat-button color="primary" type="button" (click)="loadAll()">
          Actualizar analítica
        </button>
      </app-page-header>

      <section class="stats-grid">
        <app-stat-card label="Ventas" [value]="dashboard()?.sales?.ventas ?? 0" />
        <app-stat-card label="Compras" [value]="dashboard()?.purchases?.compras ?? 0" />
        <app-stat-card label="Devoluciones" [value]="dashboard()?.returns?.devoluciones_cliente ?? 0" />
        <app-stat-card label="Stock bloqueado" [value]="dashboard()?.inventory?.unidades_bloqueadas ?? 0" />
      </section>

      <article class="surface-card card">
        <h2 class="section-title">Rotación</h2>
        <pre class="json-preview">{{ rotation() | json }}</pre>
      </article>
    </section>
  `,
  styles: `
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .card { padding: 1.25rem; }
    .json-preview {
      margin: 0;
      white-space: pre-wrap;
      overflow-x: auto;
      color: var(--color-ink-soft);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPageComponent {
  private readonly api = inject(ApiService);
  readonly dashboard = signal<any | null>(null);
  readonly rotation = signal<any[]>([]);

  constructor() {
    this.loadAll();
  }

  loadAll() {
    this.api.get('/analytics/dashboard').subscribe((response) => this.dashboard.set(response));
    this.api.get<any[]>('/analytics/rotation').subscribe((response) => this.rotation.set(response));
  }
}
