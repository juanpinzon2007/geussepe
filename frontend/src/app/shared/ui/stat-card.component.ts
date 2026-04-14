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
      padding: 1.2rem;
      display: grid;
      gap: 0.4rem;
      min-height: 132px;
    }

    .label {
      color: var(--color-ink-soft);
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
    }

    strong {
      font-family: var(--font-display);
      font-size: clamp(1.6rem, 2vw, 2.35rem);
      letter-spacing: -0.05em;
    }

    .helper {
      color: var(--color-ink-soft);
      font-size: 0.88rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly helper = input<string>('');
}
