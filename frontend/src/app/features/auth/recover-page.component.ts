import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AuthShowcaseShellComponent } from '../../shared/ui/auth-showcase-shell/auth-showcase-shell.component';

@Component({
  selector: 'app-recover-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
    AuthShowcaseShellComponent,
  ],
  template: `
    <app-auth-showcase-shell
      eyebrow="El Desquite 😈"
      title="Recupera tu acceso sin perder el estilo"
      subtitle="El flujo de recuperacion mantiene la misma estetica premium, clara y comercial del storefront."
      panelTitle="Recuperar contrasena"
      panelSubtitle="Solicita el token para volver a entrar al panel con seguridad."
      [bullets]="[
        'Flujo mas limpio para soporte interno',
        'Mismo estilo de campos y acciones',
        'Consistencia visual con login y storefront'
      ]"
      [compact]="true"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="premium-form-grid recover-form">
        <mat-form-field class="full-span">
          <mat-label>Usuario o correo</mat-label>
          <input matInput formControlName="identifier">
        </mat-form-field>

        <button mat-flat-button color="primary" class="full-span recover-form__submit" type="submit">
          Solicitar recuperacion
        </button>
      </form>

      <div class="recover-form__footer">
        <a routerLink="/auth/login">Volver al login</a>
      </div>
    </app-auth-showcase-shell>
  `,
  styles: `
    :host {
      display: block;
      padding: 1.2rem;
    }

    .recover-form__submit {
      min-height: 3.2rem;
    }

    .recover-form__footer {
      margin-top: 1rem;
    }

    .recover-form__footer a {
      color: #7be3ff;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoverPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly form = this.fb.nonNullable.group({
    identifier: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.authService.recoverRequest(this.form.getRawValue().identifier).subscribe({
      next: () => {
        this.uiFeedback.success('Solicitud de recuperacion enviada');
      },
    });
  }
}
