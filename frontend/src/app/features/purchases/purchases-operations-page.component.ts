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
  selector: 'app-purchases-operations-page',
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
        title="Compras y recepcion"
        subtitle="Registra ordenes y recepciones con formularios mejor estructurados y mas cercanos al nuevo lenguaje visual."
        eyebrow="Compras"
      />

      <section class="premium-workspace-grid">
        <app-form-section-card
          eyebrow="Orden"
          title="Orden de compra"
          description="Captura proveedor, destino, producto y costo en una composicion mas limpia."
        >
          <form [formGroup]="orderForm" (ngSubmit)="createOrder()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Id proveedor</mat-label>
              <input matInput formControlName="id_proveedor">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Id bodega destino</mat-label>
              <input matInput formControlName="id_bodega_destino">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Id producto</mat-label>
              <input matInput formControlName="id_producto">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Cantidad</mat-label>
              <input matInput type="number" formControlName="cantidad">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Costo unitario</mat-label>
              <input matInput type="number" formControlName="costo_unitario">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Crear orden</button>
          </form>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Recepcion"
          title="Registrar recepcion"
          description="Confirma cantidades recibidas y costo de entrada con una experiencia visual consistente."
        >
          <form [formGroup]="receptionForm" (ngSubmit)="createReception()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Id orden compra</mat-label>
              <input matInput formControlName="id_orden_compra">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Id producto</mat-label>
              <input matInput formControlName="id_producto">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Cantidad recibida</mat-label>
              <input matInput type="number" formControlName="cantidad_recibida">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Costo unitario</mat-label>
              <input matInput type="number" formControlName="costo_unitario">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Registrar recepcion</button>
          </form>
        </app-form-section-card>
      </section>

      <app-form-section-card
        eyebrow="Respuesta"
        title="Ultimo resultado"
        description="Respuesta mas reciente para validar el documento procesado."
      >
        <pre class="premium-json-preview">{{ lastResult() | json }}</pre>
      </app-form-section-card>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchasesOperationsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly lastResult = signal<unknown>(null);
  readonly orderForm = this.fb.nonNullable.group({
    id_proveedor: ['', Validators.required],
    id_bodega_destino: ['', Validators.required],
    id_producto: ['', Validators.required],
    cantidad: [1, Validators.required],
    costo_unitario: [1000, Validators.required],
  });
  readonly receptionForm = this.fb.nonNullable.group({
    id_orden_compra: ['', Validators.required],
    id_producto: ['', Validators.required],
    cantidad_recibida: [1, Validators.required],
    costo_unitario: [1000, Validators.required],
  });

  createOrder() {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    const value = this.orderForm.getRawValue();
    this.api
      .post('/purchases/orders', {
        id_proveedor: value.id_proveedor,
        id_bodega_destino: value.id_bodega_destino,
        detalles: [
          {
            id_producto: value.id_producto,
            cantidad: Number(value.cantidad),
            costo_unitario: Number(value.costo_unitario),
          },
        ],
      })
      .subscribe((response) => {
        this.uiFeedback.success('Orden creada');
        this.lastResult.set(response);
      });
  }

  createReception() {
    if (this.receptionForm.invalid) {
      this.receptionForm.markAllAsTouched();
      return;
    }

    const value = this.receptionForm.getRawValue();
    this.api
      .post('/purchases/receptions', {
        id_orden_compra: value.id_orden_compra,
        detalles: [
          {
            id_producto: value.id_producto,
            cantidad_recibida: Number(value.cantidad_recibida),
            costo_unitario: Number(value.costo_unitario),
          },
        ],
      })
      .subscribe((response) => {
        this.uiFeedback.success('Recepcion creada');
        this.lastResult.set(response);
      });
  }
}
