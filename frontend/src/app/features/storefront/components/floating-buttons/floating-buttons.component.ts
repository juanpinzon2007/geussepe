import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-floating-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-buttons.component.html',
  styleUrl: './floating-buttons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingButtonsComponent {
  @Input() promoLabel = 'Comunidad Webcam';
  @Input() promoUrl = 'https://es.stripchat.com/';
  @Input() helpText = 'Necesitas ayuda? Chatea con nosotros.';
  @Input() whatsappUrl = 'https://wa.me/573001234567';
  @Output() promoClick = new EventEmitter<void>();
}
