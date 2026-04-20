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
  selector: 'app-register-page',
  imports: [
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
      eyebrow="Cuenta nueva"
      title="Registro simple para entrar y comprar"
      subtitle="La cuenta se crea contra el backend real y queda almacenada en la base de datos para que el cliente vuelva cuando quiera."
      panelTitle="Crear cuenta"
      panelSubtitle="Completa lo justo para registrarte sin perder el tono premium del sitio."
      [heroVisible]="false"
      [centered]="true"
      [compact]="true"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="premium-form-grid register-form">
        <div class="register-form__signals full-span" aria-label="Ventajas del registro">
          <span>Alta inmediata</span>
          <span>Datos guardados</span>
          <span>Acceso directo</span>
        </div>

        <mat-form-field>
          <mat-label>Nombres</mat-label>
          <input matInput formControlName="nombres" autocomplete="given-name">
        </mat-form-field>

        <mat-form-field>
          <mat-label>Apellidos</mat-label>
          <input matInput formControlName="apellidos" autocomplete="family-name">
        </mat-form-field>

        <mat-form-field class="full-span">
          <mat-label>Correo</mat-label>
          <input matInput type="email" formControlName="correo_electronico" autocomplete="email">
        </mat-form-field>

        <mat-form-field>
          <mat-label>Usuario</mat-label>
          <input matInput formControlName="nombre_usuario" autocomplete="username">
        </mat-form-field>

        <mat-form-field>
          <mat-label>Telefono</mat-label>
          <input matInput formControlName="telefono" autocomplete="tel">
        </mat-form-field>

        <mat-form-field class="full-span">
          <mat-label>Contrasena</mat-label>
          <input
            matInput
            [type]="hidePassword() ? 'password' : 'text'"
            formControlName="password"
            autocomplete="new-password"
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

        <mat-form-field class="full-span">
          <mat-label>Confirmar contrasena</mat-label>
          <input
            matInput
            [type]="hideConfirmPassword() ? 'password' : 'text'"
            formControlName="confirm_password"
            autocomplete="new-password"
          >
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="toggleConfirmPassword()"
            aria-label="Mostrar u ocultar confirmacion de contrasena"
          >
            <mat-icon fontSet="material-symbols-outlined">
              {{ hideConfirmPassword() ? 'visibility' : 'visibility_off' }}
            </mat-icon>
          </button>
        </mat-form-field>

        <p class="register-form__microcopy full-span">
          Al crear la cuenta te dejamos con sesion activa para que sigas comprando sin pasos extra.
        </p>

        <button mat-flat-button color="primary" class="full-span register-form__submit" type="submit">
          Crear cuenta
        </button>
      </form>

      <div class="register-form__footer">
        <a routerLink="/auth/login">Ya tengo cuenta</a>
        <a routerLink="/auth/recover">Olvide mi contrasena</a>
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

    .register-form {
      gap: 1rem;
      max-width: 34rem;
      width: 100%;
      margin-inline: auto;
    }

    .register-form__signals {
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

    .register-form__microcopy {
      margin: -0.1rem 0 0;
      color: rgba(83, 34, 40, 0.78);
      font-size: 0.82rem;
      line-height: 1.5;
      text-align: center;
    }

    .register-form__submit {
      min-height: 3.4rem;
      font-size: 0.98rem;
      box-shadow: 0 18px 28px rgba(139, 0, 0, 0.18);
    }

    .register-form__footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1rem;
      max-width: 34rem;
      width: 100%;
      margin: 1rem auto 0;
      color: var(--color-ink-soft);
      font-weight: 700;
    }

    .register-form__footer a {
      color: var(--color-primary-strong);
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
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly hidePassword = signal(true);
  readonly hideConfirmPassword = signal(true);
  readonly form = this.fb.nonNullable.group({
    nombres: ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    correo_electronico: ['', [Validators.required, Validators.email]],
    telefono: [''],
    nombre_usuario: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required, Validators.minLength(8)]],
  });

  togglePassword() {
    this.hidePassword.set(!this.hidePassword());
  }

  toggleConfirmPassword() {
    this.hideConfirmPassword.set(!this.hideConfirmPassword());
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    if (raw.password !== raw.confirm_password) {
      this.uiFeedback.error('Las contrasenas no coinciden');
      return;
    }

    this.authService
      .register({
        nombres: raw.nombres,
        apellidos: raw.apellidos,
        correo_electronico: raw.correo_electronico,
        telefono: raw.telefono,
        nombre_usuario: raw.nombre_usuario,
        password: raw.password,
      })
      .subscribe({
        next: () => {
          this.uiFeedback.success('Cuenta creada correctamente');
          this.router.navigate(['/home']);
        },
      });
  }
}
