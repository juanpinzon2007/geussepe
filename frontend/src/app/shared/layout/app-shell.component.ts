import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { PRIMARY_NAVIGATION } from '../../core/config/navigation.config';
import { AuthService } from '../../core/services/auth.service';
import { BreadcrumbService } from '../../core/services/breadcrumb.service';
import { HttpActivityService } from '../../core/services/http-activity.service';
import { SessionStore } from '../../core/services/session.store';

@Component({
  selector: 'app-shell',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSidenavModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly sessionStore = inject(SessionStore);
  readonly breadcrumbService = inject(BreadcrumbService);
  readonly activity = inject(HttpActivityService);

  readonly mobileOpen = signal(false);
  readonly isHandset = signal(false);
  readonly user = this.sessionStore.user;
  readonly navigation = computed(() =>
    PRIMARY_NAVIGATION.filter((item) =>
      this.sessionStore.hasPermission(item.permission ?? null),
    ),
  );

  constructor() {
    this.sessionStore.hydrate();
    this.breakpointObserver
      .observe('(max-width: 1024px)')
      .pipe(map((state) => state.matches))
      .subscribe((matches) => {
        this.isHandset.set(matches);
        if (!matches) {
          this.mobileOpen.set(false);
        }
      });

    effect(() => {
      if (this.sessionStore.token() && !this.sessionStore.user()) {
        this.authService.me().subscribe();
      }
    });
  }

  toggleMenu() {
    this.mobileOpen.update((value) => !value);
  }

  closeMenu() {
    if (this.isHandset()) {
      this.mobileOpen.set(false);
    }
  }

  logout() {
    this.authService.logout().subscribe({
      complete: () => {
        this.router.navigate(['/auth/login']);
      },
    });
  }
}
