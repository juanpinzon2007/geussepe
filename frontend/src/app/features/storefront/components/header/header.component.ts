import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  @Input() brandName = 'El Desquite 😈';
  @Input() cartCount = 0;
  @Input() isAuthenticated = false;

  @Output() menuClick = new EventEmitter<void>();
  @Output() searchClick = new EventEmitter<void>();
  @Output() userClick = new EventEmitter<void>();
  @Output() cartClick = new EventEmitter<void>();
}
