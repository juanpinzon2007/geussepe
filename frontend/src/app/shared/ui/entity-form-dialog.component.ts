import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../../core/services/api.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { EntityConfig, FieldConfig } from '../../core/models/app.models';
import { environment } from '../../../environments/environment';

interface EntityFormDialogData {
  config: EntityConfig;
  isCreate: boolean;
  initialValue?: Record<string, unknown> | null;
}

interface UploadImageResponse {
  url?: string;
  path?: string;
  absolute_url?: string;
}

@Component({
  selector: 'app-entity-form-dialog',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
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
          Completa los campos con una lectura mas simple, directa y comoda.
        </p>
      </div>

      <mat-dialog-content>
        @if (guidedFields.length) {
          <form [formGroup]="form" class="premium-form-grid dialog-shell__form">
            @for (field of guidedFields; track field.key) {
              @if (field.type === 'checkbox') {
                <div class="dialog-shell__check">
                  <mat-checkbox [formControlName]="field.key">{{ field.label }}</mat-checkbox>
                </div>
              } @else if (field.type === 'file') {
                <div class="dialog-shell__file full-span">
                  <mat-form-field class="full-width">
                    <mat-label>{{ field.label }}</mat-label>
                    <input
                      matInput
                      [formControlName]="field.key"
                      [placeholder]="field.placeholder ?? 'Selecciona una imagen'"
                      readonly
                    >
                    <button
                      matSuffix
                      mat-icon-button
                      type="button"
                      [disabled]="uploadingField() === field.key"
                      (click)="filePicker.click()"
                      aria-label="Subir imagen"
                    >
                      <mat-icon>
                        {{ uploadingField() === field.key ? 'hourglass_top' : 'upload' }}
                      </mat-icon>
                    </button>
                    @if (field.hint) {
                      <mat-hint>{{ field.hint }}</mat-hint>
                    }
                  </mat-form-field>
                  <input
                    #filePicker
                    class="dialog-shell__file-input"
                    type="file"
                    [accept]="field.accept ?? 'image/*'"
                    (change)="onFileSelected(field, $event)"
                  >
                  @if (previewUrl(field); as preview) {
                    <div class="dialog-shell__preview">
                      <img [src]="preview" [alt]="field.label">
                      <div class="dialog-shell__preview-copy">
                        <strong>
                          {{ uploadingField() === field.key ? 'Subiendo imagen...' : 'Imagen lista' }}
                        </strong>
                        <span class="muted">{{ preview }}</span>
                        <button mat-button type="button" (click)="clearFile(field)">Quitar</button>
                      </div>
                    </div>
                  }
                </div>
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
      font-family: var(--font-sensual);
      font-size: 2.6rem;
      font-weight: 700;
      line-height: 0.9;
      letter-spacing: -0.04em;
      color: var(--color-ink);
    }

    .dialog-shell__header p {
      margin: 0;
    }

    .dialog-shell__form {
      align-items: start;
    }

    .dialog-shell__check {
      display: flex;
      align-items: center;
      min-height: 3.5rem;
      padding: 0 0.15rem;
    }

    .dialog-shell__file {
      display: grid;
      gap: 0.85rem;
    }

    .dialog-shell__file-input {
      display: none;
    }

    .dialog-shell__preview {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr);
      gap: 1rem;
      align-items: center;
      padding: 0.9rem;
      border-radius: 1.1rem;
      background: rgba(255, 240, 244, 0.8);
      border: 1px solid rgba(125, 29, 74, 0.14);
    }

    .dialog-shell__preview img {
      width: 110px;
      height: 110px;
      object-fit: cover;
      border-radius: 0.9rem;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 18px 35px rgba(70, 12, 36, 0.12);
    }

    .dialog-shell__preview-copy {
      display: grid;
      gap: 0.35rem;
      min-width: 0;
    }

    .dialog-shell__preview-copy span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .full-width {
      width: 100%;
    }

    mat-dialog-content {
      width: min(920px, calc(100vw - 1.5rem));
      min-width: 0;
      max-width: 100%;
      padding-top: 0.5rem;
    }

    mat-dialog-actions {
      padding-top: 1rem;
    }

    mat-checkbox {
      padding: 0.2rem 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityFormDialogComponent {
  readonly data = inject<EntityFormDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<EntityFormDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly uiFeedback = inject(UiFeedbackService);
  private readonly apiOrigin = this.resolveApiOrigin();

  readonly guidedFields = (this.data.config.formFields ?? []).filter(
    (field) => this.data.isCreate || field.key !== 'password',
  );
  readonly uploadingField = signal<string | null>(null);
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
    if (this.uploadingField()) {
      this.uiFeedback.info('Espera a que termine la carga de la imagen.');
      return;
    }

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

  onFileSelected(field: FieldConfig, event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || !field.uploadEndpoint) {
      return;
    }

    this.uploadingField.set(field.key);
    const formData = new FormData();
    formData.append('file', file);

    this.api.upload<UploadImageResponse>(field.uploadEndpoint, formData).subscribe({
      next: (response) => {
        const url = this.resolveStoredImagePath(response);
        if (!url) {
          this.uiFeedback.error('La API no devolvio una ruta valida para la imagen.');
          this.uploadingField.set(null);
          if (input) {
            input.value = '';
          }
          return;
        }

        this.form.get(field.key)?.setValue(url);
        this.form.get(field.key)?.markAsDirty();
        this.uiFeedback.success('Imagen cargada correctamente.');
        this.uploadingField.set(null);
        if (input) {
          input.value = '';
        }
      },
      error: () => {
        this.uiFeedback.error('No se pudo subir la imagen.');
        this.uploadingField.set(null);
        if (input) {
          input.value = '';
        }
      },
    });
  }

  clearFile(field: FieldConfig) {
    this.form.get(field.key)?.setValue(null);
    this.form.get(field.key)?.markAsDirty();
  }

  previewUrl(field: FieldConfig) {
    const value = this.form.get(field.key)?.value;
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    return this.resolvePreviewUrl(value.trim());
  }

  private resolveStoredImagePath(response: UploadImageResponse) {
    const candidates = [response.path, response.url, response.absolute_url];

    for (const candidate of candidates) {
      if (!candidate || !candidate.trim()) {
        continue;
      }

      const normalized = candidate.trim();

      if (normalized.startsWith('/uploads/') || normalized.startsWith('/assets/')) {
        return normalized;
      }

      if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
        try {
          const parsed = new URL(normalized);
          return parsed.pathname + parsed.search;
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private resolvePreviewUrl(value: string) {
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
      return value;
    }

    if (value.startsWith('/uploads/')) {
      return `${this.apiOrigin}${value}`;
    }

    if (value.startsWith('/assets/')) {
      return `${window.location.origin}${value}`;
    }

    return value;
  }

  private resolveApiOrigin() {
    try {
      return new URL(environment.apiBaseUrl, window.location.origin).origin;
    } catch {
      return window.location.origin;
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
