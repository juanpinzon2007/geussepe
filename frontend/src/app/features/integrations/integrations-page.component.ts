import { CommonModule, JsonPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { timer } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-integrations-page',
  imports: [CommonModule, JsonPipe, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <app-page-header
        title="Integraciones empresariales"
        subtitle="Consulta sistemas externos y sincronizaciones registradas por el backend."
        eyebrow="Integraciones"
      />

      <section class="workspace-grid">
        <article class="surface-card card">
          <h2 class="section-title">Sistemas</h2>
          <pre class="json-preview">{{ systems() | json }}</pre>
        </article>
        <article class="surface-card card">
          <h2 class="section-title">Sincronizaciones</h2>
          <pre class="json-preview">{{ syncs() | json }}</pre>
        </article>
      </section>
    </section>
  `,
  styles: `
    .workspace-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
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
export class IntegrationsPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  readonly systems = signal<unknown>(null);
  readonly syncs = signal<unknown>(null);

  constructor() {
    timer(0, 20000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadAll());
  }

  loadAll() {
    this.api.get('/integrations/systems', { limit: 20 }).subscribe((response) => this.systems.set(response));
    this.api.get('/integrations/syncs', { limit: 20 }).subscribe((response) => this.syncs.set(response));
  }
}
