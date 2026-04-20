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
  selector: 'app-sales-operations-page',
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
        title="Ventas y ecommerce"
        subtitle="Registra ventas y pedidos ecommerce con formularios mejor organizados y visualmente consistentes."
        eyebrow="Ventas"
      />

      <section class="premium-workspace-grid">
        <app-form-section-card
          eyebrow="Venta"
          title="Pedido de venta"
          description="Captura cliente, bodega, producto y precio en un bloque visual mas claro."
        >
          <form [formGroup]="saleForm" (ngSubmit)="createSaleOrder()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Id cliente</mat-label>
              <input matInput formControlName="id_cliente">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Id bodega</mat-label>
              <input matInput formControlName="id_bodega">
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
              <mat-label>Precio unitario</mat-label>
              <input matInput type="number" formControlName="precio_unitario">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Crear pedido</button>
          </form>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Ecommerce"
          title="Pedido ecommerce"
          description="Dispara el flujo ecommerce con una composicion alineada al store."
        >
          <form [formGroup]="ecommerceForm" (ngSubmit)="createEcommerceOrder()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Canal</mat-label>
              <input matInput formControlName="canal">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Id cliente</mat-label>
              <input matInput formControlName="id_cliente">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Id producto</mat-label>
              <input matInput formControlName="id_producto">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Cantidad</mat-label>
              <input matInput type="number" formControlName="cantidad">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Crear ecommerce</button>
          </form>
        </app-form-section-card>
      </section>

      <app-form-section-card
        eyebrow="Respuesta"
        title="Ultimo resultado"
        description="Respuesta mas reciente del backend para validar el pedido creado."
      >
        <pre class="premium-json-preview">{{ lastResult() | json }}</pre>
      </app-form-section-card>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOperationsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly lastResult = signal<unknown>(null);
  readonly saleForm = this.fb.nonNullable.group({
    id_cliente: ['', Validators.required],
    id_bodega: ['', Validators.required],
    id_producto: ['', Validators.required],
    cantidad: [1, Validators.required],
    precio_unitario: [20000, Validators.required],
  });
  readonly ecommerceForm = this.fb.nonNullable.group({
    canal: ['WEB', Validators.required],
    id_cliente: ['', Validators.required],
    id_producto: ['', Validators.required],
    cantidad: [1, Validators.required],
  });

  createSaleOrder() {
    if (this.saleForm.invalid) {
      this.saleForm.markAllAsTouched();
      return;
    }

    const value = this.saleForm.getRawValue();
    this.api
      .post('/sales/orders', {
        id_cliente: value.id_cliente,
        id_bodega: value.id_bodega,
        detalles: [
          {
            id_producto: value.id_producto,
            cantidad: Number(value.cantidad),
            precio_unitario: Number(value.precio_unitario),
          },
        ],
      })
      .subscribe((response) => {
        this.uiFeedback.success('Pedido de venta creado');
        this.lastResult.set(response);
      });
  }

  createEcommerceOrder() {
    if (this.ecommerceForm.invalid) {
      this.ecommerceForm.markAllAsTouched();
      return;
    }

    const value = this.ecommerceForm.getRawValue();
    this.api
      .post('/sales/ecommerce-orders', {
        canal_origen: value.canal,
        id_cliente: value.id_cliente,
        detalles: [
          {
            id_producto: value.id_producto,
            cantidad: Number(value.cantidad),
          },
        ],
      })
      .subscribe((response) => {
        this.uiFeedback.success('Pedido ecommerce creado');
        this.lastResult.set(response);
      });
  }
}
