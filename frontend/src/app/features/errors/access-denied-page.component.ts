import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied-page',
  imports: [MatButtonModule, RouterLink],
  template: `
    <main class="error-shell">
      <section class="surface-card card">
        <span class="badge">403</span>
        <h1>Acceso denegado</h1>
        <p class="muted">
          Tu sesión no tiene los permisos necesarios para abrir esta sección.
        </p>
        <a mat-flat-button color="primary" routerLink="/app/dashboard">
          Volver al dashboard
        </a>
      </section>
    </main>
  `,
  styles: `
    .error-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 1.5rem;
    }

    .card {
      max-width: 520px;
      padding: 2rem;
      text-align: center;
    }

    h1 {
      margin: 1rem 0 0.5rem;
      font-family: var(--font-display);
      font-size: 2.2rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessDeniedPageComponent {}
