import { CommonModule, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/services/auth.service';
import { SessionStore } from '../../core/services/session.store';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { FormSectionCardComponent } from '../../shared/ui/form-section-card/form-section-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-profile-page',
  imports: [
    CommonModule,
    JsonPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    FormSectionCardComponent,
  ],
  template: `
    <section class="page-grid">
      <app-page-header
        title="Mi perfil"
        subtitle="Informacion de sesion, roles, permisos y cambio de contrasena con una UI mas consistente."
        eyebrow="Perfil"
      />

      <section class="premium-workspace-grid">
        <app-form-section-card
          eyebrow="Sesion"
          title="Contexto autenticado"
          description="Vista rapida del usuario activo para soporte, control y trazabilidad."
        >
          <pre class="premium-json-preview">{{ sessionStore.user() | json }}</pre>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Seguridad"
          title="Cambiar contrasena"
          description="Actualiza tu clave con el mismo lenguaje visual del store."
        >
          <form [formGroup]="form" (ngSubmit)="changePassword()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Contrasena actual</mat-label>
              <input matInput type="password" formControlName="current_password">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Nueva contrasena</mat-label>
              <input matInput type="password" formControlName="new_password">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Actualizar contrasena</button>
          </form>
        </app-form-section-card>
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly uiFeedback = inject(UiFeedbackService);
  readonly sessionStore = inject(SessionStore);

  readonly form = this.fb.nonNullable.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
  });

  changePassword() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.authService.changePassword(this.form.getRawValue()).subscribe(() => {
      this.uiFeedback.success('Contrasena actualizada');
      this.form.reset();
    });
  }
}
