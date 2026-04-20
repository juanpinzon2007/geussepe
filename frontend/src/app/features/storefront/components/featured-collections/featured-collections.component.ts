import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorefrontCollection } from '../../data-access/storefront.models';
import {
  STOREFRONT_CATALOG_SECTIONS,
  StorefrontCatalogSection,
} from '../../data-access/storefront-curation.data';

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

  private readonly sectionsByTitle = new Map<string, StorefrontCatalogSection>(
    STOREFRONT_CATALOG_SECTIONS.map((section) => [this.normalize(section.title), section]),
  );

  selectCollection(collection: StorefrontCollection) {
    this.collectionSelected.emit(collection);
  }

  previewItems(collection: StorefrontCollection) {
    return this.sectionsByTitle.get(this.normalize(collection.title))?.items.slice(0, 3) ?? [];
  }

  getSpotlight(collection: StorefrontCollection) {
    return (
      this.sectionsByTitle.get(this.normalize(collection.title))?.spotlight ??
      'Descubre una seleccion sensual, discreta y lista para comprar.'
    );
  }

  trackByCollection(index: number, collection: StorefrontCollection) {
    return collection.id || index;
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
