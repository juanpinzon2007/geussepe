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
  selector: 'app-audit-page',
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
        title="Auditoria operativa"
        subtitle="Consulta eventos y responde aprobaciones con formularios mas consistentes."
        eyebrow="Auditoria"
      />

      <section class="premium-workspace-grid">
        <app-form-section-card
          eyebrow="Eventos"
          title="Eventos recientes"
          description="Consulta la trazabilidad operativa mas reciente."
        >
          <button mat-flat-button color="primary" type="button" (click)="loadEvents()">
            Consultar eventos
          </button>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Aprobacion"
          title="Responder aprobacion"
          description="Gestiona solicitudes con un formulario mas claro."
        >
          <form [formGroup]="approvalForm" (ngSubmit)="respondApproval()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Id solicitud</mat-label>
              <input matInput formControlName="id">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Decision</mat-label>
              <input matInput formControlName="decision">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Enviar</button>
          </form>
        </app-form-section-card>
      </section>

      <app-form-section-card
        eyebrow="Respuesta"
        title="Ultimo resultado"
        description="Respuesta mas reciente de auditoria."
      >
        <pre class="premium-json-preview">{{ lastResult() | json }}</pre>
      </app-form-section-card>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly lastResult = signal<unknown>(null);
  readonly approvalForm = this.fb.nonNullable.group({
    id: ['', Validators.required],
    decision: ['APROBADO', Validators.required],
  });

  loadEvents() {
    this.api.get('/audit/events').subscribe((response) => this.lastResult.set(response));
  }

  respondApproval() {
    if (this.approvalForm.invalid) {
      this.approvalForm.markAllAsTouched();
      return;
    }

    const value = this.approvalForm.getRawValue();
    this.api
      .post(`/audit/approval-requests/${value.id}/respond`, {
        decision: value.decision,
      })
      .subscribe((response) => {
        this.uiFeedback.success('Respuesta registrada');
        this.lastResult.set(response);
      });
  }
}
