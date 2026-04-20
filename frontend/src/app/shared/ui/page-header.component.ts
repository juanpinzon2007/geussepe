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
        radial-gradient(circle at top right, rgba(255, 74, 74, 0.16), transparent 26%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 245, 245, 0.96));
    }

    h1 {
      margin: 0.75rem 0 0.45rem;
      font-family: var(--font-sensual);
      font-size: clamp(2.3rem, 4vw, 3.2rem);
      font-weight: 700;
      letter-spacing: -0.05em;
      line-height: 0.94;
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
