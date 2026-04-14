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
      eyebrow="El Desquite 😈"
      title="Gestion premium para tu tienda sensual"
      subtitle="Un acceso mas elegante, visual y consistente con la identidad comercial de El Desquite."
      panelTitle="Iniciar sesion"
      panelSubtitle="Usa tus credenciales para entrar al panel operativo con el nuevo look premium."
      [bullets]="[
        'Acceso visual unificado con la tienda',
        'Interfaz mas limpia para gestion y operaciones',
        'Catalogo, pedidos y clientes desde un solo lugar'
      ]"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="premium-form-grid auth-form">
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
          Entrar al panel
        </button>
      </form>

      <div class="auth-form__footer">
        <a routerLink="/auth/recover">Recuperar contrasena</a>
        <span>admin / Admin123*</span>
      </div>
    </app-auth-showcase-shell>
  `,
  styles: `
    :host {
      display: block;
      padding: 1.2rem;
    }

    .auth-form {
      gap: 1.1rem;
    }

    .auth-form__submit {
      min-height: 3.3rem;
      font-size: 0.95rem;
    }

    .auth-form__footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1rem;
      color: rgba(229, 235, 255, 0.72);
      font-weight: 700;
    }

    .auth-form__footer a {
      color: #7be3ff;
      font-weight: 600;
    }

    @media (max-width: 960px) {
      :host {
        padding: 1rem;
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
      next: () => {
        this.uiFeedback.success('Sesion iniciada');
        this.router.navigate(['/app/dashboard']);
      },
    });
  }
}
