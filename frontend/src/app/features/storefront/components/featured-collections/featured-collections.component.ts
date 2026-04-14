import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorefrontCollection } from '../../data-access/storefront.models';

@Component({
  selector: 'app-featured-collections',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './featured-collections.component.html',
  styleUrl: './featured-collections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedCollectionsComponent {
  @Input({ required: true }) collections: StorefrontCollection[] = [];
  @Output() collectionSelected = new EventEmitter<StorefrontCollection>();

  trackByCollection(index: number, collection: StorefrontCollection) {
    return collection.id || index;
  }
}
