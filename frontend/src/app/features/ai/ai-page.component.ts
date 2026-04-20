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
  selector: 'app-ai-page',
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
        title="IA operativa"
        subtitle="Ejecuta pronostico de demanda y extraccion documental desde formularios mas pulidos."
        eyebrow="IA"
      />

      <section class="premium-workspace-grid">
        <app-form-section-card
          eyebrow="Forecast"
          title="Pronostico de demanda"
          description="Lanza escenarios de demanda con un formulario claro y visualmente consistente."
        >
          <form [formGroup]="forecastForm" (ngSubmit)="forecastDemand()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Id producto</mat-label>
              <input matInput formControlName="id_producto">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Horizonte dias</mat-label>
              <input matInput type="number" formControlName="dias_horizonte">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Predecir</button>
          </form>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Extraccion"
          title="Extraer documento"
          description="Procesa texto y metadatos con un bloque visual mejor estructurado."
        >
          <form [formGroup]="extractForm" (ngSubmit)="extractDocument()" class="premium-form-grid">
            <mat-form-field class="full-span">
              <mat-label>Texto o metadata</mat-label>
              <textarea matInput rows="5" formControlName="contenido"></textarea>
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Extraer</button>
          </form>
        </app-form-section-card>
      </section>

      <app-form-section-card
        eyebrow="Salida"
        title="Resultado IA"
        description="Respuesta mas reciente del modulo de inteligencia."
      >
        <pre class="premium-json-preview">{{ result() | json }}</pre>
      </app-form-section-card>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly result = signal<unknown>(null);
  readonly forecastForm = this.fb.nonNullable.group({
    id_producto: ['', Validators.required],
    dias_horizonte: [30, Validators.required],
  });
  readonly extractForm = this.fb.nonNullable.group({
    contenido: ['', Validators.required],
  });

  forecastDemand() {
    if (this.forecastForm.invalid) {
      this.forecastForm.markAllAsTouched();
      return;
    }

    this.api
      .post('/ai/forecast-demand', this.forecastForm.getRawValue())
      .subscribe((response) => {
        this.uiFeedback.success('Pronostico generado');
        this.result.set(response);
      });
  }

  extractDocument() {
    if (this.extractForm.invalid) {
      this.extractForm.markAllAsTouched();
      return;
    }

    this.api
      .post('/ai/extract-document', this.extractForm.getRawValue())
      .subscribe((response) => {
        this.uiFeedback.success('Extraccion completada');
        this.result.set(response);
      });
  }
}
