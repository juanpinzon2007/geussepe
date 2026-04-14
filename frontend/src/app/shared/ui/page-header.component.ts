import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-page-header',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <section class="page-header surface-card">
      <div>
        @if (eyebrow()) {
          <span class="badge">{{ eyebrow() }}</span>
        }
        <h1>{{ title() }}</h1>
        <p class="muted">{{ subtitle() }}</p>
      </div>
      <div class="actions">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    .page-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.5rem;
      align-items: flex-start;
      background:
        radial-gradient(circle at top right, rgba(201, 182, 228, 0.18), transparent 26%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 248, 251, 0.96));
    }

    h1 {
      margin: 0.75rem 0 0.45rem;
      font-family: var(--font-display);
      font-size: clamp(1.7rem, 2vw, 2.35rem);
      letter-spacing: -0.06em;
    }

    p {
      max-width: 52rem;
      margin: 0;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
}
