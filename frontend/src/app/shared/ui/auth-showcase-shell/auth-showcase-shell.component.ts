import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-showcase-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-showcase-shell.component.html',
  styleUrl: './auth-showcase-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthShowcaseShellComponent {
  readonly eyebrow = input('El Desquite');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly bullets = input<string[]>([]);
  readonly panelTitle = input('Acceso seguro');
  readonly panelSubtitle = input('Continua con tu operacion.');
  readonly compact = input(false);
  readonly heroVisible = input(true);
}
