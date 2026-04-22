import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../core/services/api.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { EntityConfig, FieldConfig } from '../../core/models/app.models';

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

interface SelectFieldOption {
  label: string;
  value: string | number;
}

interface FormSectionGroup {
  name: string;
  fields: FieldConfig[];
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
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
      <div class="dialog-shell">
        <div class="dialog-shell__header">
          <div class="dialog-shell__header-copy">
            <span class="badge">{{ data.isCreate ? 'Nuevo registro' : 'Edicion' }}</span>
          <h2 mat-dialog-title>
            {{ data.isCreate ? 'Crear' : 'Actualizar' }} {{ data.config.title.toLowerCase() }}
          </h2>
          <p class="muted">
            Ordenamos los campos en bloques claros para que el flujo del admin sea mas rapido y
            menos cansado.
          </p>
        </div>

          @if (guidedFields.length) {
            <div class="dialog-shell__summary">
              <strong>{{ guidedFields.length }}</strong>
              <span>campos listos</span>
            </div>
          }
      </div>

      <mat-dialog-content>
        @if (guidedFields.length) {
          <form [formGroup]="form" class="dialog-shell__stack">
            @for (section of sectionedFields(); track section.name) {
              <section class="dialog-shell__section">
                <div class="dialog-shell__section-header">
                  <span class="dialog-shell__section-kicker">{{ section.name }}</span>
                </div>

                <div class="dialog-shell__form">
                  @for (field of section.fields; track field.key) {
                    @if (field.type === 'checkbox') {
                      <div
                        class="dialog-shell__check"
                        [class.full-span]="isFullSpan(field)"
                      >
                        <mat-checkbox [formControlName]="field.key">{{ field.label }}</mat-checkbox>
                        @if (field.hint) {
                          <span class="dialog-shell__inline-hint">{{ field.hint }}</span>
                        }
                      </div>
                    } @else if (field.type === 'file') {
                      <div
                        class="dialog-shell__file"
                        [class.full-span]="isFullSpan(field)"
                      >
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
                            <mat-icon fontSet="material-symbols-outlined">
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
                    } @else if (field.type === 'select') {
                      <mat-form-field [class.full-span]="isFullSpan(field)">
                        <mat-label>{{ field.label }}</mat-label>
                        <mat-select [formControlName]="field.key">
                          @if (!field.required) {
                            <mat-option [value]="null">Sin seleccionar</mat-option>
                          }
                          @for (option of optionsFor(field); track option.value) {
                            <mat-option [value]="option.value">{{ option.label }}</mat-option>
                          }
                        </mat-select>
                        @if (field.hint) {
                          <mat-hint>{{ field.hint }}</mat-hint>
                        }
                      </mat-form-field>
                    } @else {
                      <mat-form-field [class.full-span]="isFullSpan(field)">
                        <mat-label>{{ field.label }}</mat-label>
                        <input
                          *ngIf="field.type !== 'textarea'"
                          matInput
                          [formControlName]="field.key"
                          [type]="field.type === 'number' ? 'number' : field.type"
                          [placeholder]="field.placeholder ?? ''"
                        >
                        <textarea
                          *ngIf="field.type === 'textarea'"
                          matInput
                          [rows]="field.rows ?? 4"
                          [formControlName]="field.key"
                          [placeholder]="field.placeholder ?? ''"
                        ></textarea>
                        @if (field.hint) {
                          <mat-hint>{{ field.hint }}</mat-hint>
                        }
                      </mat-form-field>
                    }
                  }
                </div>
              </section>
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

      <mat-dialog-actions align="end" class="dialog-shell__actions">
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
      gap: 0.75rem;
      max-height: min(92vh, 980px);
    }

    .dialog-shell__header {
      display: grid;
      gap: 0.85rem;
      padding: 0.25rem 0.25rem 0;
    }

    .dialog-shell__header-copy {
      display: grid;
      gap: 0.45rem;
    }

    .dialog-shell__header h2 {
      margin: 0;
      font-family: var(--font-admin-display);
      font-size: clamp(2.2rem, 4vw, 3rem);
      font-weight: 700;
      line-height: 0.92;
      letter-spacing: -0.03em;
      color: var(--color-admin-ink);
    }

    .dialog-shell__header p {
      margin: 0;
      max-width: 40rem;
    }

    .dialog-shell__summary {
      display: grid;
      gap: 0.15rem;
      width: fit-content;
      padding: 0.95rem 1rem;
      border-radius: 1.2rem;
      background: linear-gradient(180deg, rgba(255, 251, 247, 0.88), rgba(247, 237, 231, 0.96));
      border: 1px solid rgba(122, 24, 48, 0.1);
      text-align: left;
    }

    .dialog-shell__summary strong {
      font-family: var(--font-admin-display);
      font-size: 1.5rem;
      line-height: 1;
      color: var(--color-admin-ink);
    }

    .dialog-shell__summary span {
      color: var(--color-admin-ink-soft);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .dialog-shell__stack {
      display: grid;
      gap: 1rem;
    }

    .dialog-shell__section {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
      border-radius: 1.4rem;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.46), rgba(255, 248, 243, 0.76));
      border: 1px solid rgba(122, 24, 48, 0.08);
    }

    .dialog-shell__section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
    }

    .dialog-shell__section-kicker {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      padding: 0.36rem 0.7rem;
      border-radius: 999px;
      background: rgba(122, 24, 48, 0.08);
      color: var(--color-admin-burgundy);
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .dialog-shell__form {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }

    .dialog-shell__form > * {
      min-width: 0;
    }

    .dialog-shell__check {
      display: grid;
      gap: 0.35rem;
      padding: 0.55rem 0.8rem;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.46);
      border: 1px solid rgba(122, 24, 48, 0.06);
    }

    .dialog-shell__inline-hint {
      color: var(--color-admin-ink-soft);
      font-size: 0.8rem;
      line-height: 1.5;
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
      padding: 0.95rem;
      border-radius: 1.1rem;
      background: rgba(255, 244, 246, 0.92);
      border: 1px solid rgba(122, 24, 48, 0.12);
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
      width: min(720px, calc(100vw - 1.5rem));
      min-width: 0;
      max-width: 100%;
      max-height: min(70vh, 720px);
      overflow: auto;
      padding-top: 0.5rem;
      padding-bottom: 1rem;
    }

    .dialog-shell__actions {
      position: sticky;
      bottom: 0;
      z-index: 2;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 0.95rem 0.25rem 0.25rem;
      margin-top: -0.25rem;
      background: linear-gradient(180deg, rgba(247, 237, 231, 0), rgba(247, 237, 231, 0.96) 34%);
    }

    mat-checkbox {
      padding: 0.1rem 0;
    }

    @media (max-width: 768px) {
      .dialog-shell__summary {
        min-width: 0;
        text-align: left;
      }

      .dialog-shell__preview {
        grid-template-columns: 1fr;
      }
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

  readonly guidedFields = (this.data.config.formFields ?? []).filter(
    (field) => this.data.isCreate || field.key !== 'password',
  );
  readonly uploadingField = signal<string | null>(null);
  readonly selectOptions = signal<Record<string, SelectFieldOption[]>>({});
  readonly sectionedFields = computed<FormSectionGroup[]>(() => {
    const groups = new Map<string, FieldConfig[]>();

    for (const field of this.guidedFields) {
      const sectionName = field.section?.trim() || 'General';
      groups.set(sectionName, [...(groups.get(sectionName) ?? []), field]);
    }

    return Array.from(groups.entries()).map(([name, fields]) => ({ name, fields }));
  });
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

  constructor() {
    this.preloadSelectOptions();
  }

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

  optionsFor(field: FieldConfig) {
    return this.selectOptions()[field.key] ?? [];
  }

  isFullSpan(field: FieldConfig) {
    return field.columnSpan === 'full' || field.type === 'textarea' || field.type === 'file';
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
        const url = this.normalizeStoredImagePath(response);
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
    return typeof value === 'string' && value.trim() ? this.api.resolveAssetUrl(value) : null;
  }

  private preloadSelectOptions() {
    for (const field of this.guidedFields) {
      if (field.type !== 'select' || !field.optionConfig) {
        continue;
      }

      const query = {
        limit: 200,
        page: 1,
        ...(field.optionConfig.query ?? {}),
      };

      this.api.get<any[]>(field.optionConfig.endpoint, query).subscribe({
        next: (rows) => {
          const options = rows
            .map((row) => ({
              label: String(row[field.optionConfig!.labelKey] ?? ''),
              value: row[field.optionConfig!.valueKey] as string | number,
            }))
            .filter((option) => option.label && option.value !== null && option.value !== undefined)
            .sort((left, right) => left.label.localeCompare(right.label, 'es'));

          this.selectOptions.update((current) => ({ ...current, [field.key]: options }));
        },
        error: () => {
          this.selectOptions.update((current) => ({ ...current, [field.key]: [] }));
        },
      });
    }
  }

  private normalizeStoredImagePath(response: UploadImageResponse) {
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
          if (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/assets/')) {
            return parsed.pathname + parsed.search;
          }

          return parsed.toString();
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private resolveValue(field: FieldConfig, initialValue?: Record<string, unknown> | null) {
    if (initialValue && field.key in initialValue) {
      return initialValue[field.key] as string | number | boolean | null;
    }

    if (field.defaultValue !== undefined) {
      return field.defaultValue;
    }

    if (field.type === 'checkbox') {
      return false;
    }

    if (field.type === 'select') {
      return null;
    }

    return '';
  }

  private normalizeValue(field: FieldConfig, value: unknown) {
    if (field.type === 'number') {
      return value === '' || value === null ? null : Number(value);
    }

    if (field.type === 'checkbox') {
      return Boolean(value);
    }

    if (field.type === 'select') {
      return value === '' ? null : value;
    }

    return value === '' ? null : value;
  }
}
