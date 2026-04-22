import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-page-header',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <section class="page-header surface-card">
      <div class="page-header__copy">
        @if (eyebrow()) {
          <span class="page-header__eyebrow">{{ eyebrow() }}</span>
        }
        <h1>{{ title() }}</h1>
        <p class="muted">{{ subtitle() }}</p>
      </div>
      <div class="actions">
        <ng-content />
      </div>
      <span class="page-header__ornament" aria-hidden="true"></span>
    </section>
  `,
  styles: `
    .page-header {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 1rem;
      padding: clamp(1.4rem, 3vw, 2rem);
      align-items: flex-start;
      background:
        radial-gradient(circle at top right, rgba(200, 163, 108, 0.18), transparent 26%),
        radial-gradient(circle at left center, rgba(122, 24, 48, 0.12), transparent 24%),
        linear-gradient(135deg, rgba(255, 251, 247, 0.98), rgba(247, 237, 231, 0.96));
      overflow: hidden;
    }

    .page-header__copy {
      position: relative;
      z-index: 1;
      max-width: 50rem;
    }

    .page-header__eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-admin-burgundy);
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .page-header__eyebrow::before {
      content: '';
      width: 2.5rem;
      height: 1px;
      background: linear-gradient(90deg, var(--color-admin-burgundy), var(--color-admin-gold));
    }

    h1 {
      margin: 0.75rem 0 0.55rem;
      font-family: var(--font-admin-display);
      font-size: clamp(2.5rem, 4.2vw, 3.6rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 0.92;
    }

    p {
      max-width: 52rem;
      margin: 0;
      line-height: 1.7;
    }

    .actions {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }

    .page-header__ornament {
      position: absolute;
      right: 1.2rem;
      bottom: 1rem;
      width: 8rem;
      height: 8rem;
      border-radius: 50%;
      background:
        radial-gradient(circle, rgba(200, 163, 108, 0.2), rgba(200, 163, 108, 0) 70%);
      pointer-events: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
}
