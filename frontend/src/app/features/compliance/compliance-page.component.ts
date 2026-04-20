import { CommonModule, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../../core/services/api.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { FormSectionCardComponent } from '../../shared/ui/form-section-card/form-section-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-compliance-page',
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
        title="Cumplimiento y privacidad"
        subtitle="Administra consentimientos y solicitudes con formularios mas consistentes con el nuevo diseño."
        eyebrow="Cumplimiento"
      />

      <section class="premium-workspace-grid">
        <app-form-section-card
          eyebrow="Consentimientos"
          title="Listar consentimientos"
          description="Consulta rapidamente el estado de autorizaciones registradas."
        >
          <button mat-flat-button color="primary" type="button" (click)="listConsents()">
            Consultar consentimientos
          </button>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Habeas data"
          title="Responder solicitud"
          description="Registra la respuesta con un bloque mas limpio y legible."
        >
          <form [formGroup]="habeasForm" (ngSubmit)="respondHabeas()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Id solicitud</mat-label>
              <input matInput formControlName="id">
            </mat-form-field>
            <mat-form-field class="full-span">
              <mat-label>Respuesta</mat-label>
              <textarea matInput rows="4" formControlName="respuesta"></textarea>
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Responder</button>
          </form>
        </app-form-section-card>
      </section>

      <app-form-section-card
        eyebrow="Respuesta"
        title="Ultimo resultado"
        description="Salida del backend para validar la gestion de cumplimiento."
      >
        <pre class="premium-json-preview">{{ lastResult() | json }}</pre>
      </app-form-section-card>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompliancePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly lastResult = signal<unknown>(null);
  readonly habeasForm = this.fb.nonNullable.group({
    id: ['', Validators.required],
    respuesta: ['', Validators.required],
  });

  listConsents() {
    this.api.get('/compliance/consents', { limit: 20 }).subscribe((response) => {
      this.lastResult.set(response);
    });
  }

  respondHabeas() {
    if (this.habeasForm.invalid) {
      this.habeasForm.markAllAsTouched();
      return;
    }

    const value = this.habeasForm.getRawValue();
    this.api
      .post(`/compliance/habeas-requests/${value.id}/respond`, {
        respuesta: value.respuesta,
      })
      .subscribe((response) => {
        this.uiFeedback.success('Solicitud respondida');
        this.lastResult.set(response);
      });
  }
}
