import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  template: `
    <article class="stat-card surface-card">
      <span class="label">{{ label() }}</span>
      <strong>{{ value() }}</strong>
      @if (helper()) {
        <span class="helper">{{ helper() }}</span>
      }
    </article>
  `,
  styles: `
    .stat-card {
      position: relative;
      padding: 1.2rem;
      display: grid;
      gap: 0.5rem;
      min-height: 132px;
      overflow: hidden;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }

    .stat-card::after {
      content: '';
      position: absolute;
      inset: auto 1.1rem 1rem 1.1rem;
      height: 1px;
      background: linear-gradient(90deg, rgba(122, 24, 48, 0.16), rgba(200, 163, 108, 0.32));
    }

    .stat-card:hover {
      transform: translateY(-3px);
    }

    .label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-ink-soft);
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
    }

    .label::before {
      content: '';
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--color-admin-gold), var(--color-admin-burgundy));
      box-shadow: 0 0 0 4px rgba(200, 163, 108, 0.12);
    }

    strong {
      font-family: var(--font-admin-display);
      font-size: clamp(2rem, 3vw, 3rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 0.95;
      color: var(--color-admin-ink);
    }

    .helper {
      color: var(--color-admin-ink-soft);
      font-size: 0.88rem;
      line-height: 1.55;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly helper = input<string>('');
}
