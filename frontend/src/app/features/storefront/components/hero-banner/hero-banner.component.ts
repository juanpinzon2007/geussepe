import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorefrontHero } from '../../data-access/storefront.models';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero-banner.component.html',
  styleUrl: './hero-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroBannerComponent {
  @Input({ required: true }) hero: StorefrontHero | null = null;
  @Output() buyNow = new EventEmitter<void>();

  trackByProduct(index: number) {
    return index;
  }
}
