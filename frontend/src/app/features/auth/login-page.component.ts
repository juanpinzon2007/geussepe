import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AuthShowcaseShellComponent } from '../../shared/ui/auth-showcase-shell/auth-showcase-shell.component';

@Component({
  selector: 'app-login-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
    AuthShowcaseShellComponent,
  ],
  template: `
    <app-auth-showcase-shell
      eyebrow="Acceso privado"
      title="Entra rapido y sin distracciones"
      subtitle="Quitamos la columna lateral para dejar el inicio de sesion centrado, mas claro y mas comodo para el cliente."
      panelTitle="Iniciar sesion"
      panelSubtitle="Accede a tu cuenta con una experiencia limpia, sensual y enfocada en entrar sin friccion."
      [heroVisible]="false"
      [centered]="true"
      [compact]="true"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="premium-form-grid auth-form">
        <div class="auth-form__signals full-span" aria-label="Beneficios del acceso">
          <span>Acceso rapido</span>
          <span>Privado</span>
          <span>Look premium</span>
        </div>

        <mat-form-field class="full-span">
          <mat-label>Usuario o correo</mat-label>
          <input matInput formControlName="username" autocomplete="username">
        </mat-form-field>

        <mat-form-field class="full-span">
          <mat-label>Contrasena</mat-label>
          <input
            matInput
            [type]="hidePassword() ? 'password' : 'text'"
            formControlName="password"
            autocomplete="current-password"
          >
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="togglePassword()"
            aria-label="Mostrar u ocultar contrasena"
          >
            <mat-icon fontSet="material-symbols-outlined">
              {{ hidePassword() ? 'visibility' : 'visibility_off' }}
            </mat-icon>
          </button>
        </mat-form-field>

        <button mat-flat-button color="primary" class="full-span auth-form__submit" type="submit">
          Entrar
        </button>

        <p class="auth-form__microcopy full-span">
          Todo el flujo esta pensado para entrar en segundos y mantener el tono seductor de la marca.
        </p>
      </form>

      <div class="auth-form__footer">
        <a routerLink="/auth/recover">Recuperar contrasena</a>
        <a routerLink="/auth/register">Crear cuenta</a>
        <div class="auth-form__hint">
          <small>Demo de acceso</small>
          <strong>admin / Admin123*</strong>
        </div>
      </div>
    </app-auth-showcase-shell>
  `,
  styles: `
    :host {
      display: grid;
      align-items: center;
      min-height: 100vh;
      padding: 1.2rem;
      background:
        radial-gradient(circle at top right, rgba(255, 140, 165, 0.22), transparent 20%),
        radial-gradient(circle at bottom left, rgba(139, 0, 0, 0.18), transparent 28%),
        linear-gradient(180deg, #090203, #220608 44%, #32090c);
    }

    .auth-form {
      gap: 1rem;
      max-width: 32rem;
      width: 100%;
      margin-inline: auto;
    }

    .auth-form__signals {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.55rem;

      span {
        display: inline-flex;
        align-items: center;
        padding: 0.45rem 0.8rem;
        border-radius: 999px;
        border: 1px solid rgba(139, 0, 0, 0.1);
        background: rgba(255, 255, 255, 0.7);
        color: #7a111b;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
    }

    .auth-form__submit {
      min-height: 3.45rem;
      font-size: 0.98rem;
      letter-spacing: 0.01em;
      box-shadow: 0 18px 28px rgba(139, 0, 0, 0.18);
    }

    .auth-form__microcopy {
      margin: -0.15rem 0 0;
      color: rgba(83, 34, 40, 0.78);
      font-size: 0.82rem;
      line-height: 1.5;
    }

    .auth-form__footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 1rem;
      max-width: 32rem;
      width: 100%;
      margin-inline: auto;
      color: var(--color-ink-soft);
      font-weight: 700;
    }

    .auth-form__hint {
      display: grid;
      gap: 0.18rem;
      justify-items: end;
      padding: 0.8rem 0.95rem;
      border-radius: 1rem;
      background: rgba(139, 0, 0, 0.06);
      border: 1px solid rgba(139, 0, 0, 0.08);

      small {
        color: rgba(83, 34, 40, 0.76);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      strong {
        color: var(--color-ink);
        line-height: 1.1;
      }
    }

    .auth-form__footer a {
      color: var(--color-primary-strong);
      font-weight: 600;
    }

    @media (max-width: 960px) {
      :host {
        padding: 1rem;
      }

      .auth-form__hint {
        justify-items: start;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly hidePassword = signal(true);
  readonly form = this.fb.nonNullable.group({
    username: ['admin', Validators.required],
    password: ['Admin123*', Validators.required],
  });

  togglePassword() {
    this.hidePassword.set(!this.hidePassword());
  }

    submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.authService.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.uiFeedback.success('Sesion iniciada');
        this.router.navigate([this.resolvePostLoginRoute(response.user.permissions)]);
      },
    });
  }

  private resolvePostLoginRoute(permissions: string[]) {
    return permissions.length ? '/app/dashboard' : '/home';
  }
}
