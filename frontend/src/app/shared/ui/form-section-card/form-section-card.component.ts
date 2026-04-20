import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-form-section-card',
  standalone: true,
  template: `
    <article class="form-card surface-card">
      <div class="form-card__header">
        @if (eyebrow()) {
          <span class="form-card__eyebrow">{{ eyebrow() }}</span>
        }
        <div class="form-card__copy">
          <h2>{{ title() }}</h2>
          @if (description()) {
            <p>{{ description() }}</p>
          }
        </div>
        <div class="form-card__actions">
          <ng-content select="[card-actions]" />
        </div>
      </div>

      <div class="form-card__body">
        <ng-content />
      </div>
    </article>
  `,
  styles: `
    .form-card {
      position: relative;
      overflow: hidden;
      padding: 1.25rem;
    }

    .form-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 4px;
      background: linear-gradient(90deg, var(--color-primary), var(--color-primary-strong));
    }

    .form-card__header {
      display: grid;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .form-card__eyebrow {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      padding: 0.34rem 0.7rem;
      border-radius: 999px;
      background: rgba(139, 0, 0, 0.08);
      color: var(--color-primary-strong);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .form-card__copy {
      display: grid;
      gap: 0.28rem;
    }

    .form-card__copy h2 {
      margin: 0;
      color: var(--color-ink);
      font-family: var(--font-sensual);
      font-size: 2rem;
      font-weight: 700;
      line-height: 0.96;
      letter-spacing: -0.03em;
    }

    .form-card__copy p {
      margin: 0;
      color: var(--color-ink-soft);
      line-height: 1.45;
    }

    .form-card__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }

    .form-card__body {
      position: relative;
      z-index: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormSectionCardComponent {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly description = input('');
}
