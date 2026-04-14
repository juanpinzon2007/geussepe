import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EntityConfig, FieldConfig } from '../../core/models/app.models';

interface EntityFormDialogData {
  config: EntityConfig;
  isCreate: boolean;
  initialValue?: Record<string, unknown> | null;
}

@Component({
  selector: 'app-entity-form-dialog',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <div class="dialog-shell">
      <div class="dialog-shell__header">
        <span class="badge">{{ data.isCreate ? 'Nuevo registro' : 'Edicion' }}</span>
        <h2 mat-dialog-title>
          {{ data.isCreate ? 'Crear' : 'Actualizar' }} {{ data.config.title.toLowerCase() }}
        </h2>
        <p class="muted">
          Usa un formulario mas limpio y consistente para capturar la informacion operativa.
        </p>
      </div>

      <mat-dialog-content>
        @if (guidedFields.length) {
          <form [formGroup]="form" class="premium-form-grid">
            @for (field of guidedFields; track field.key) {
              @if (field.type === 'checkbox') {
                <mat-checkbox [formControlName]="field.key">{{ field.label }}</mat-checkbox>
              } @else {
                <mat-form-field [class.full-span]="field.type === 'textarea'">
                  <mat-label>{{ field.label }}</mat-label>
                  <input
                    *ngIf="field.type !== 'textarea'"
                    matInput
                    [formControlName]="field.key"
                    [type]="field.type === 'number' ? 'number' : field.type"
                  >
                  <textarea
                    *ngIf="field.type === 'textarea'"
                    matInput
                    [rows]="field.rows ?? 4"
                    [formControlName]="field.key"
                  ></textarea>
                  @if (field.hint) {
                    <mat-hint>{{ field.hint }}</mat-hint>
                  }
                </mat-form-field>
              }
            }
          </form>
        } @else {
          <mat-form-field class="full-width">
            <mat-label>Payload JSON</mat-label>
            <textarea
              matInput
              rows="18"
              [formControl]="jsonControl"
              spellcheck="false"
            ></textarea>
          </mat-form-field>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">Cancelar</button>
        <button mat-flat-button color="primary" type="button" (click)="submit()">
          Guardar
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: `
    .dialog-shell {
      display: grid;
      gap: 0.5rem;
    }

    .dialog-shell__header {
      display: grid;
      gap: 0.45rem;
      padding: 0.25rem 0.25rem 0;
    }

    .dialog-shell__header h2 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 1.8rem;
      letter-spacing: -0.06em;
      color: var(--color-ink);
    }

    .dialog-shell__header p {
      margin: 0;
    }

    .full-width {
      width: 100%;
    }

    mat-dialog-content {
      min-width: min(860px, 88vw);
      padding-top: 0.5rem;
    }

    mat-dialog-actions {
      padding-top: 1rem;
    }

    mat-checkbox {
      padding: 0.6rem 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityFormDialogComponent {
  readonly data = inject<EntityFormDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<EntityFormDialogComponent>);
  private readonly fb = inject(FormBuilder);

  readonly guidedFields = (this.data.config.formFields ?? []).filter(
    (field) => this.data.isCreate || field.key !== 'password',
  );
  readonly form = this.fb.group(
    this.guidedFields.reduce<Record<string, unknown>>((controls, field) => {
      controls[field.key] = [
        this.resolveValue(field, this.data.initialValue),
        field.required ? Validators.required : [],
      ];
      return controls;
    }, {}),
  );
  readonly jsonControl = this.fb.nonNullable.control(
    JSON.stringify(this.data.initialValue ?? {}, null, 2),
    Validators.required,
  );

  submit() {
    if (this.guidedFields.length) {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        return;
      }

      const raw = this.form.getRawValue();
      const payload = this.guidedFields.reduce<Record<string, unknown>>((result, field) => {
        const value = raw[field.key];
        if (value !== undefined) {
          result[field.key] = this.normalizeValue(field, value);
        }
        return result;
      }, {});

      this.dialogRef.close(payload);
      return;
    }

    if (this.jsonControl.invalid) {
      this.jsonControl.markAsTouched();
      return;
    }

    try {
      this.dialogRef.close(JSON.parse(this.jsonControl.getRawValue()));
    } catch {
      this.jsonControl.setErrors({ invalidJson: true });
    }
  }

  private resolveValue(field: FieldConfig, initialValue?: Record<string, unknown> | null) {
    if (initialValue && field.key in initialValue) {
      return initialValue[field.key] as string | number | boolean | null;
    }

    if (field.defaultValue !== undefined) {
      return field.defaultValue;
    }

    return field.type === 'checkbox' ? false : '';
  }

  private normalizeValue(field: FieldConfig, value: unknown) {
    if (field.type === 'number') {
      return value === '' || value === null ? null : Number(value);
    }

    if (field.type === 'checkbox') {
      return Boolean(value);
    }

    return value === '' ? null : value;
  }
}
