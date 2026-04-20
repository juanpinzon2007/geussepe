import { CommonModule, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../../core/services/api.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { FormSectionCardComponent } from '../../shared/ui/form-section-card/form-section-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-inventory-operations-page',
  imports: [
    CommonModule,
    JsonPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    FormSectionCardComponent,
  ],
  template: `
    <section class="page-grid">
      <app-page-header
        title="Operaciones de inventario"
        subtitle="Consulta stock, registra movimientos, reservas y traslados desde formularios mas claros y consistentes."
        eyebrow="Inventario"
      />

      <section class="premium-workspace-grid">
        <app-form-section-card
          eyebrow="Consulta"
          title="Consulta de stock"
          description="Revisa producto, bodega y alertas con un formulario mas limpio."
        >
          <form [formGroup]="stockForm" (ngSubmit)="queryStock()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Id producto</mat-label>
              <input matInput formControlName="id_producto">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Id bodega</mat-label>
              <input matInput formControlName="id_bodega">
            </mat-form-field>
            <mat-checkbox formControlName="only_low_stock">Solo bajo stock</mat-checkbox>
            <button mat-flat-button color="primary" type="submit">Consultar</button>
          </form>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Movimiento"
          title="Documento manual"
          description="Registra entradas o ajustes con estructura mas ordenada."
        >
          <form [formGroup]="manualForm" (ngSubmit)="createManualDocument()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Tipo documento</mat-label>
              <input matInput formControlName="tipo_documento">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Codigo movimiento</mat-label>
              <input matInput formControlName="movement_code">
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
            <mat-checkbox formControlName="apply_now">Aplicar de inmediato</mat-checkbox>
            <button mat-flat-button color="primary" type="submit">Registrar</button>
          </form>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Reserva"
          title="Reserva de inventario"
          description="Bloquea unidades para un origen operativo definido."
        >
          <form [formGroup]="reservationForm" (ngSubmit)="createReservation()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Id producto</mat-label>
              <input matInput formControlName="id_producto">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Id bodega</mat-label>
              <input matInput formControlName="id_bodega">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Cantidad</mat-label>
              <input matInput type="number" formControlName="cantidad">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Tipo origen</mat-label>
              <input matInput formControlName="tipo_origen">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Reservar</button>
          </form>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Traslado"
          title="Traslado entre bodegas"
          description="Mueve inventario con la misma estetica del resto del sistema."
        >
          <form [formGroup]="transferForm" (ngSubmit)="createTransfer()" class="premium-form-grid">
            <mat-form-field>
              <mat-label>Bodega origen</mat-label>
              <input matInput formControlName="id_bodega_origen">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Bodega destino</mat-label>
              <input matInput formControlName="id_bodega_destino">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Id producto</mat-label>
              <input matInput formControlName="id_producto">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Cantidad</mat-label>
              <input matInput type="number" formControlName="cantidad_solicitada">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit">Crear traslado</button>
          </form>
        </app-form-section-card>
      </section>

      <app-form-section-card
        eyebrow="Respuesta"
        title="Ultimo resultado"
        description="Salida del backend para validar la operacion ejecutada."
      >
        <pre class="premium-json-preview">{{ lastResult() | json }}</pre>
      </app-form-section-card>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryOperationsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly lastResult = signal<unknown>(null);
  readonly stockForm = this.fb.group({
    id_producto: [''],
    id_bodega: [''],
    only_low_stock: [false],
  });
  readonly manualForm = this.fb.nonNullable.group({
    tipo_documento: ['AJUSTE_MANUAL', Validators.required],
    movement_code: ['ENTRADA_MANUAL', Validators.required],
    id_bodega: ['', Validators.required],
    id_producto: ['', Validators.required],
    cantidad: [1, Validators.required],
    apply_now: [true],
  });
  readonly reservationForm = this.fb.nonNullable.group({
    id_producto: ['', Validators.required],
    id_bodega: ['', Validators.required],
    cantidad: [1, Validators.required],
    tipo_origen: ['VENTA_WEB', Validators.required],
  });
  readonly transferForm = this.fb.nonNullable.group({
    id_bodega_origen: ['', Validators.required],
    id_bodega_destino: ['', Validators.required],
    id_producto: ['', Validators.required],
    cantidad_solicitada: [1, Validators.required],
  });

  queryStock() {
    this.api.get('/inventory/stock', this.stockForm.getRawValue()).subscribe((response) => {
      this.lastResult.set(response);
    });
  }

  createManualDocument() {
    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      return;
    }

    const value = this.manualForm.getRawValue();
    this.api
      .post('/inventory/manual-documents', {
        tipo_documento: value.tipo_documento,
        movement_code: value.movement_code,
        id_bodega: value.id_bodega,
        apply_now: value.apply_now,
        lines: [
          {
            id_producto: value.id_producto,
            cantidad: Number(value.cantidad),
          },
        ],
      })
      .subscribe((response) => {
        this.uiFeedback.success('Documento manual registrado');
        this.lastResult.set(response);
      });
  }

  createReservation() {
    if (this.reservationForm.invalid) {
      this.reservationForm.markAllAsTouched();
      return;
    }

    const value = this.reservationForm.getRawValue();
    this.api
      .post('/inventory/reservations', {
        ...value,
        cantidad: Number(value.cantidad),
      })
      .subscribe((response) => {
        this.uiFeedback.success('Reserva creada');
        this.lastResult.set(response);
      });
  }

  createTransfer() {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }

    const value = this.transferForm.getRawValue();
    this.api
      .post('/inventory/transfers', {
        id_bodega_origen: value.id_bodega_origen,
        id_bodega_destino: value.id_bodega_destino,
        detalles: [
          {
            id_producto: value.id_producto,
            cantidad_solicitada: Number(value.cantidad_solicitada),
          },
        ],
      })
      .subscribe((response) => {
        this.uiFeedback.success('Traslado creado');
        this.lastResult.set(response);
      });
  }
}
