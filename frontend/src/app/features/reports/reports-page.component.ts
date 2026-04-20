import { CommonModule, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../../core/services/api.service';
import { FormSectionCardComponent } from '../../shared/ui/form-section-card/form-section-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-reports-page',
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
        title="Centro de reportes"
        subtitle="Ejecuta reportes operativos y regulatorios con filtros mas claros y mejor presentados."
        eyebrow="Reportes"
      />

      <app-form-section-card
        eyebrow="Filtros"
        title="Ejecutar reporte"
        description="Define reporte y rango de fechas desde un formulario alineado al nuevo sistema."
      >
        <form [formGroup]="form" (ngSubmit)="runReport()" class="premium-form-grid">
          <mat-form-field>
            <mat-label>Reporte</mat-label>
            <input matInput formControlName="report">
          </mat-form-field>
          <mat-form-field>
            <mat-label>Fecha desde</mat-label>
            <input matInput type="date" formControlName="fecha_desde">
          </mat-form-field>
          <mat-form-field>
            <mat-label>Fecha hasta</mat-label>
            <input matInput type="date" formControlName="fecha_hasta">
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit">Ejecutar</button>
        </form>
      </app-form-section-card>

      <app-form-section-card
        eyebrow="Salida"
        title="Salida del reporte"
        description="Resultado generado por el backend segun los filtros aplicados."
      >
        <pre class="premium-json-preview">{{ result() | json }}</pre>
      </app-form-section-card>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  readonly result = signal<unknown>(null);
  readonly form = this.fb.nonNullable.group({
    report: ['inventory'],
    fecha_desde: ['2026-01-01'],
    fecha_hasta: ['2026-12-31'],
  });

  runReport() {
    const value = this.form.getRawValue();
    this.api
      .get(`/reports/${value.report}`, {
        fecha_desde: value.fecha_desde,
        fecha_hasta: value.fecha_hasta,
      })
      .subscribe((response) => this.result.set(response));
  }
}
