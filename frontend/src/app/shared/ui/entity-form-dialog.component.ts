import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
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
          <div class="dialog-shell__header-tags">
            <span class="badge">{{ data.config.badge ?? 'Gestion' }}</span>
            <span class="dialog-shell__mode">
              {{ data.isCreate ? 'Alta guiada' : 'Edicion guiada' }}
            </span>
          </div>
          <h2 mat-dialog-title>
            {{ data.isCreate ? 'Crear' : 'Actualizar' }} {{ data.config.title.toLowerCase() }}
          </h2>
          <p class="dialog-shell__subtitle">{{ data.config.subtitle }}</p>
        </div>

        @if (guidedFields.length) {
          <div class="dialog-shell__summary">
            <strong>{{ guidedFields.length }}</strong>
            <span>campos</span>
            <small>{{ sectionedFields().length }} bloques</small>
          </div>
        }
      </div>

      <mat-dialog-content>
        @if (guidedFields.length) {
          <div class="dialog-shell__layout">
            <aside class="dialog-shell__aside">
              <section class="dialog-shell__aside-card">
                <div class="dialog-shell__aside-heading">
                  <span class="dialog-shell__aside-kicker">Resumen operativo</span>
                  <span class="dialog-shell__aside-caption">
                    {{ data.isCreate ? 'Captura nueva' : 'Edicion activa' }}
                  </span>
                </div>

                <div class="dialog-shell__metric-grid">
                  <article class="dialog-shell__metric">
                    <strong>{{ requiredFieldsCount }}</strong>
                    <span>Obligatorios</span>
                  </article>
                  <article class="dialog-shell__metric">
                    <strong>{{ optionalFieldsCount }}</strong>
                    <span>Opcionales</span>
                  </article>
                  <article class="dialog-shell__metric">
                    <strong>{{ sectionedFields().length }}</strong>
                    <span>Secciones</span>
                  </article>
                </div>

                <div class="dialog-shell__progress">
                  <div class="dialog-shell__progress-copy">
                    <strong>{{ completedFieldCount() }}/{{ guidedFields.length }}</strong>
                    <span>campos completos</span>
                  </div>
                  <div class="dialog-shell__progress-bar">
                    <span [style.width.%]="completionPercentage()"></span>
                  </div>
                </div>
              </section>

              <section class="dialog-shell__aside-card">
                <div class="dialog-shell__aside-heading">
                  <span class="dialog-shell__aside-kicker">Navegacion rapida</span>
                  <span class="dialog-shell__aside-caption">Todo al alcance</span>
                </div>

                <nav class="dialog-shell__navigator">
                  @for (section of sectionedFields(); track section.name) {
                    <button
                      type="button"
                      class="dialog-shell__nav-item"
                      [class.is-complete]="sectionCompletedCount(section) === section.fields.length"
                      (click)="scrollToSection(section.name)"
                    >
                      <span>{{ section.name }}</span>
                      <small>{{ sectionCompletedCount(section) }}/{{ section.fields.length }}</small>
                    </button>
                  }
                </nav>

                <p class="dialog-shell__aside-note">
                  Los obligatorios se validan y el guardado queda fijo en la parte inferior.
                </p>
              </section>
            </aside>

            <form [formGroup]="form" class="dialog-shell__stack">
              @for (section of sectionedFields(); track section.name) {
                <section
                  class="dialog-shell__section"
                  [attr.data-section]="sectionAnchor(section.name)"
                >
                  <div class="dialog-shell__section-header">
                    <div class="dialog-shell__section-copy">
                      <span class="dialog-shell__section-kicker">{{ section.name }}</span>
                      <p>
                        @if (sectionRequiredCount(section)) {
                          {{ sectionRequiredCount(section) }} obligatorios y
                        }
                        {{ section.fields.length }} campos en total
                      </p>
                    </div>

                    <span
                      class="dialog-shell__section-count"
                      [class.is-complete]="sectionCompletedCount(section) === section.fields.length"
                    >
                      {{ sectionCompletedCount(section) }}/{{ section.fields.length }}
                    </span>
                  </div>

                  <div class="dialog-shell__form">
                    @for (field of section.fields; track field.key) {
                      <div class="dialog-shell__field" [class.full-span]="isFullSpan(field)">
                        @if (field.type === 'checkbox') {
                          <div class="dialog-shell__toggle-card">
                            <div class="dialog-shell__toggle-main">
                              <mat-checkbox [formControlName]="field.key">{{ field.label }}</mat-checkbox>
                              @if (field.required) {
                                <span class="dialog-shell__field-badge">Obligatorio</span>
                              }
                            </div>
                            @if (field.hint) {
                              <p class="dialog-shell__field-note">{{ field.hint }}</p>
                            }
                            @if (showError(field)) {
                              <span class="dialog-shell__error">{{ errorMessage(field) }}</span>
                            }
                          </div>
                        } @else if (field.type === 'file') {
                          <div class="dialog-shell__upload-card">
                            <div class="dialog-shell__upload-top">
                              <div class="dialog-shell__upload-copy">
                                <span class="dialog-shell__upload-title">{{ field.label }}</span>
                                <p>{{ field.hint ?? 'Selecciona un archivo y el sistema lo asociara al registro.' }}</p>
                              </div>

                              <div class="dialog-shell__upload-actions">
                                @if (field.required) {
                                  <span class="dialog-shell__field-badge">Obligatorio</span>
                                }
                                <button
                                  mat-stroked-button
                                  type="button"
                                  [disabled]="uploadingField() === field.key"
                                  (click)="filePicker.click()"
                                >
                                  <mat-icon fontSet="material-symbols-outlined">
                                    {{ uploadingField() === field.key ? 'hourglass_top' : 'upload' }}
                                  </mat-icon>
                                  {{ uploadingField() === field.key ? 'Subiendo...' : 'Seleccionar imagen' }}
                                </button>
                              </div>
                            </div>

                            <input
                              #filePicker
                              class="dialog-shell__file-input"
                              type="file"
                              [accept]="field.accept ?? 'image/*'"
                              (change)="onFileSelected(field, $event)"
                            >

                            @if (storedValue(field); as value) {
                              <span class="dialog-shell__upload-path">{{ value }}</span>
                            }

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

                            @if (showError(field)) {
                              <span class="dialog-shell__error">{{ errorMessage(field) }}</span>
                            }
                          </div>
                        } @else if (field.type === 'select') {
                          <div class="dialog-shell__field-flags">
                            @if (field.required) {
                              <span class="dialog-shell__field-badge">Obligatorio</span>
                            }
                          </div>

                          <mat-form-field class="full-width">
                            <mat-label>{{ field.label }}</mat-label>
                            <mat-select [formControlName]="field.key">
                              @if (!field.required) {
                                <mat-option [value]="null">Sin seleccionar</mat-option>
                              }
                              @for (option of optionsFor(field); track option.value) {
                                <mat-option [value]="option.value">{{ option.label }}</mat-option>
                              }
                            </mat-select>
                            @if (showError(field)) {
                              <mat-error>{{ errorMessage(field) }}</mat-error>
                            } @else if (field.hint) {
                              <mat-hint>{{ field.hint }}</mat-hint>
                            }
                          </mat-form-field>
                        } @else {
                          <div class="dialog-shell__field-flags">
                            @if (field.required) {
                              <span class="dialog-shell__field-badge">Obligatorio</span>
                            }
                          </div>

                          <mat-form-field class="full-width">
                            <mat-label>{{ field.label }}</mat-label>
                            <input
                              *ngIf="field.type !== 'textarea'"
                              matInput
                              [formControlName]="field.key"
                              [type]="field.type === 'number' ? 'number' : field.type"
                              [step]="field.type === 'number' ? 'any' : null"
                              [placeholder]="field.placeholder ?? ''"
                              (keydown)="preventNumericStep(field, $event)"
                              (wheel)="preventNumericWheel(field, $event)"
                            >
                            <textarea
                              *ngIf="field.type === 'textarea'"
                              matInput
                              [rows]="field.rows ?? 4"
                              [formControlName]="field.key"
                              [placeholder]="field.placeholder ?? ''"
                            ></textarea>
                            @if (showError(field)) {
                              <mat-error>{{ errorMessage(field) }}</mat-error>
                            } @else if (field.hint) {
                              <mat-hint>{{ field.hint }}</mat-hint>
                            }
                          </mat-form-field>
                        }
                      </div>
                    }
                  </div>
                </section>
              }
            </form>
          </div>
        } @else {
          <section class="dialog-shell__json-card">
            <div class="dialog-shell__section-header">
              <div class="dialog-shell__section-copy">
                <span class="dialog-shell__section-kicker">Payload manual</span>
                <p>Esta entidad no tiene formulario guiado, asi que se edita como JSON.</p>
              </div>
            </div>

            <mat-form-field class="full-width">
              <mat-label>Payload JSON</mat-label>
              <textarea
                matInput
                rows="18"
                [formControl]="jsonControl"
                spellcheck="false"
              ></textarea>
              @if (jsonControl.hasError('invalidJson')) {
                <mat-error>El JSON no es valido.</mat-error>
              }
            </mat-form-field>
          </section>
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
      gap: 0.85rem;
      max-height: min(94vh, 1040px);
    }

    .dialog-shell__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 0.15rem 0.25rem 0;
    }

    .dialog-shell__header-copy {
      display: grid;
      gap: 0.45rem;
      max-width: 54rem;
    }

    .dialog-shell__header-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      align-items: center;
    }

    .dialog-shell__mode {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      background: rgba(122, 24, 48, 0.08);
      color: var(--color-admin-burgundy);
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .dialog-shell__header h2 {
      margin: 0;
      font-family: var(--font-admin-display);
      font-size: clamp(1.9rem, 3vw, 2.45rem);
      font-weight: 700;
      line-height: 0.96;
      letter-spacing: -0.03em;
      color: var(--color-admin-ink);
    }

    .dialog-shell__subtitle {
      margin: 0;
      max-width: 48rem;
      color: var(--color-admin-ink-soft);
      line-height: 1.55;
    }

    .dialog-shell__summary {
      display: grid;
      gap: 0.16rem;
      width: fit-content;
      min-width: 7rem;
      padding: 0.8rem 0.95rem;
      border-radius: 1.2rem;
      background:
        radial-gradient(circle at top right, rgba(200, 163, 108, 0.16), transparent 45%),
        linear-gradient(180deg, rgba(255, 251, 247, 0.92), rgba(247, 237, 231, 0.98));
      border: 1px solid rgba(122, 24, 48, 0.12);
      text-align: left;
      box-shadow: 0 16px 34px rgba(67, 10, 24, 0.08);
    }

    .dialog-shell__summary strong {
      font-family: var(--font-admin-display);
      font-size: 1.55rem;
      line-height: 1;
      color: var(--color-admin-ink);
    }

    .dialog-shell__summary span {
      color: var(--color-admin-ink-soft);
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .dialog-shell__summary small {
      color: var(--color-admin-ink-soft);
      font-size: 0.78rem;
      font-weight: 600;
    }

    .dialog-shell__layout {
      display: grid;
      grid-template-columns: minmax(250px, 290px) minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }

    .dialog-shell__aside {
      display: grid;
      gap: 0.85rem;
      position: sticky;
      top: 0;
      align-self: start;
    }

    .dialog-shell__aside-card,
    .dialog-shell__json-card {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
      border-radius: 1.35rem;
      background:
        radial-gradient(circle at top right, rgba(200, 163, 108, 0.14), transparent 42%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 248, 243, 0.92));
      border: 1px solid rgba(122, 24, 48, 0.1);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
    }

    .dialog-shell__aside-heading {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .dialog-shell__aside-kicker {
      color: var(--color-admin-burgundy);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .dialog-shell__aside-caption {
      color: var(--color-admin-ink-soft);
      font-size: 0.78rem;
      font-weight: 600;
    }

    .dialog-shell__metric-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.6rem;
    }

    .dialog-shell__metric {
      display: grid;
      gap: 0.15rem;
      padding: 0.8rem 0.75rem;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.64);
      border: 1px solid rgba(122, 24, 48, 0.08);
      text-align: center;
    }

    .dialog-shell__metric strong {
      color: var(--color-admin-burgundy-strong);
      font-size: 1.2rem;
      font-weight: 800;
      line-height: 1;
    }

    .dialog-shell__metric span {
      color: var(--color-admin-ink-soft);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .dialog-shell__progress {
      display: grid;
      gap: 0.6rem;
    }

    .dialog-shell__progress-copy {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.75rem;
    }

    .dialog-shell__progress-copy strong {
      color: var(--color-admin-ink);
      font-size: 1rem;
      font-weight: 800;
    }

    .dialog-shell__progress-copy span {
      color: var(--color-admin-ink-soft);
      font-size: 0.78rem;
    }

    .dialog-shell__progress-bar {
      overflow: hidden;
      height: 0.6rem;
      border-radius: 999px;
      background: rgba(122, 24, 48, 0.08);
    }

    .dialog-shell__progress-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #7a1830 0%, #b34761 60%, #d9b072 100%);
      transition: width 160ms ease;
    }

    .dialog-shell__navigator {
      display: grid;
      gap: 0.55rem;
    }

    .dialog-shell__nav-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.8rem 0.9rem;
      border: 1px solid rgba(122, 24, 48, 0.1);
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.66);
      color: var(--color-admin-ink);
      text-align: left;
      transition:
        transform 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease;
    }

    .dialog-shell__nav-item:hover {
      transform: translateY(-1px);
      border-color: rgba(122, 24, 48, 0.22);
      box-shadow: 0 12px 24px rgba(67, 10, 24, 0.08);
    }

    .dialog-shell__nav-item span {
      font-weight: 700;
    }

    .dialog-shell__nav-item small {
      color: var(--color-admin-ink-soft);
      font-size: 0.76rem;
      font-weight: 700;
    }

    .dialog-shell__nav-item.is-complete {
      border-color: rgba(122, 24, 48, 0.18);
      background: rgba(255, 244, 246, 0.84);
    }

    .dialog-shell__aside-note {
      margin: 0;
      color: var(--color-admin-ink-soft);
      font-size: 0.84rem;
      line-height: 1.55;
    }

    .dialog-shell__stack {
      display: grid;
      gap: 0.9rem;
    }

    .dialog-shell__section {
      display: grid;
      gap: 0.9rem;
      align-content: start;
      min-width: 0;
      padding: 1rem;
      border-radius: 1.35rem;
      background:
        radial-gradient(circle at top right, rgba(200, 163, 108, 0.12), transparent 42%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 248, 243, 0.88));
      border: 1px solid rgba(122, 24, 48, 0.09);
    }

    .dialog-shell__section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem 0.75rem;
    }

    .dialog-shell__section-copy {
      display: grid;
      gap: 0.22rem;
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

    .dialog-shell__section-copy p {
      margin: 0;
      color: var(--color-admin-ink-soft);
      line-height: 1.45;
    }

    .dialog-shell__section-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 4.25rem;
      padding: 0.45rem 0.7rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.68);
      border: 1px solid rgba(122, 24, 48, 0.1);
      color: var(--color-admin-ink-soft);
      font-size: 0.76rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .dialog-shell__section-count.is-complete {
      background: rgba(255, 244, 246, 0.9);
      color: var(--color-admin-burgundy);
      border-color: rgba(122, 24, 48, 0.16);
    }

    .dialog-shell__form {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 0.8rem;
      align-items: start;
    }

    .dialog-shell__field {
      grid-column: span 6;
      min-width: 0;
    }

    .dialog-shell__field.full-span {
      grid-column: 1 / -1;
    }

    .dialog-shell__field-flags {
      display: flex;
      justify-content: flex-end;
      min-height: 1.5rem;
      margin-bottom: 0.25rem;
    }

    .dialog-shell__field-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.24rem 0.56rem;
      border-radius: 999px;
      background: rgba(122, 24, 48, 0.09);
      color: var(--color-admin-burgundy);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .dialog-shell__toggle-card {
      display: grid;
      gap: 0.45rem;
      padding: 0.88rem 1rem;
      border-radius: 1.05rem;
      background: rgba(255, 255, 255, 0.62);
      border: 1px solid rgba(122, 24, 48, 0.08);
      min-height: 100%;
    }

    .dialog-shell__toggle-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
    }

    .dialog-shell__field-note {
      margin: 0;
      color: var(--color-admin-ink-soft);
      font-size: 0.84rem;
      line-height: 1.5;
    }

    .dialog-shell__upload-card {
      display: grid;
      gap: 0.8rem;
      padding: 1rem;
      border-radius: 1.15rem;
      background: rgba(255, 255, 255, 0.64);
      border: 1px solid rgba(122, 24, 48, 0.09);
    }

    .dialog-shell__upload-top {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .dialog-shell__upload-copy {
      display: grid;
      gap: 0.28rem;
      max-width: 32rem;
    }

    .dialog-shell__upload-title {
      color: var(--color-admin-ink);
      font-weight: 700;
    }

    .dialog-shell__upload-copy p {
      margin: 0;
      color: var(--color-admin-ink-soft);
      line-height: 1.5;
    }

    .dialog-shell__upload-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: 0.6rem;
      margin-left: auto;
    }

    .dialog-shell__file-input {
      display: none;
    }

    .dialog-shell__upload-path {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-admin-ink-soft);
      font-size: 0.82rem;
      font-family: ui-monospace, 'SFMono-Regular', monospace;
    }

    .dialog-shell__preview {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 0.85rem;
      align-items: center;
      padding: 0.8rem;
      border-radius: 1rem;
      background: rgba(255, 244, 246, 0.92);
      border: 1px solid rgba(122, 24, 48, 0.12);
    }

    .dialog-shell__preview img {
      width: 96px;
      height: 96px;
      object-fit: cover;
      border-radius: 0.8rem;
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

    .dialog-shell__error {
      color: var(--color-danger);
      font-size: 0.79rem;
      font-weight: 600;
      line-height: 1.45;
    }

    .full-width {
      width: 100%;
    }

    mat-dialog-content {
      width: 100%;
      min-width: 0;
      max-width: 100%;
      max-height: min(84vh, 900px);
      overflow: auto;
      padding-top: 0.35rem;
      padding-bottom: 0.9rem;
      scrollbar-gutter: stable;
      scroll-behavior: smooth;
    }

    .dialog-shell__actions {
      position: sticky;
      bottom: 0;
      z-index: 2;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 0.8rem 0.25rem 0.25rem;
      margin-top: -0.25rem;
      background: linear-gradient(180deg, rgba(247, 237, 231, 0), rgba(247, 237, 231, 0.96) 34%);
    }

    mat-checkbox {
      padding: 0.1rem 0;
    }

    .dialog-shell__json-card {
      padding: 1rem;
    }

    input[type='number'] {
      appearance: textfield;
      -moz-appearance: textfield;
    }

    input[type='number']::-webkit-outer-spin-button,
    input[type='number']::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    @media (max-width: 1140px) {
      .dialog-shell__layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .dialog-shell__aside {
        position: static;
      }

      .dialog-shell__form {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dialog-shell__field {
        grid-column: span 1;
      }

      .dialog-shell__field.full-span {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 768px) {
      .dialog-shell__header {
        display: grid;
      }

      .dialog-shell__summary {
        min-width: 0;
        text-align: left;
      }

      .dialog-shell__metric-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .dialog-shell__form {
        grid-template-columns: minmax(0, 1fr);
      }

      .dialog-shell__field,
      .dialog-shell__field.full-span {
        grid-column: 1;
      }

      .dialog-shell__upload-top {
        display: grid;
      }

      .dialog-shell__upload-actions {
        justify-content: flex-start;
        margin-left: 0;
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly guidedFields = (this.data.config.formFields ?? []).filter(
    (field) => this.data.isCreate || field.key !== 'password',
  );
  readonly requiredFieldsCount = this.guidedFields.filter((field) => field.required).length;
  readonly optionalFieldsCount = this.guidedFields.length - this.requiredFieldsCount;
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
        {
          value: this.resolveValue(field, this.data.initialValue),
          disabled: Boolean(field.disabled),
        },
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
    afterNextRender(() => {
      this.focusFirstField();
    });
  }

  submit() {
    if (this.uploadingField()) {
      this.uiFeedback.info('Espera a que termine la carga de la imagen.');
      return;
    }

    if (this.guidedFields.length) {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.focusFirstInvalidField();
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

  completedFieldCount() {
    return this.guidedFields.filter((field) => this.isFieldCompleted(field)).length;
  }

  completionPercentage() {
    if (!this.guidedFields.length) {
      return 0;
    }

    return Math.round((this.completedFieldCount() / this.guidedFields.length) * 100);
  }

  sectionCompletedCount(section: FormSectionGroup) {
    return section.fields.filter((field) => this.isFieldCompleted(field)).length;
  }

  sectionRequiredCount(section: FormSectionGroup) {
    return section.fields.filter((field) => field.required).length;
  }

  sectionAnchor(sectionName: string) {
    return sectionName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  scrollToSection(sectionName: string) {
    const anchor = this.sectionAnchor(sectionName);
    const section = this.host.nativeElement.querySelector<HTMLElement>(`[data-section="${anchor}"]`);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  showError(field: FieldConfig) {
    const control = this.form.get(field.key);
    return Boolean(control?.invalid && (control.touched || control.dirty));
  }

  errorMessage(field: FieldConfig) {
    const control = this.form.get(field.key);

    if (control?.hasError('required')) {
      return 'Este campo es obligatorio.';
    }

    if (control?.hasError('email')) {
      return 'Ingresa un correo valido.';
    }

    return 'Revisa el valor ingresado.';
  }

  storedValue(field: FieldConfig) {
    const value = this.form.get(field.key)?.value;
    return typeof value === 'string' && value.trim() ? value : null;
  }

  preventNumericStep(field: FieldConfig, event: KeyboardEvent) {
    if (field.type !== 'number') {
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
    }
  }

  preventNumericWheel(field: FieldConfig, event: WheelEvent) {
    if (field.type !== 'number') {
      return;
    }

    event.preventDefault();
    const target = event.target as HTMLInputElement | null;
    target?.blur();
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

  private isFieldCompleted(field: FieldConfig) {
    const control = this.form.get(field.key);

    if (!control || control.disabled) {
      return true;
    }

    const value = control.value;

    if (field.type === 'checkbox') {
      return field.required ? Boolean(value) : true;
    }

    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    return true;
  }

  private focusFirstField() {
    const target = this.host.nativeElement.querySelector<HTMLElement>(
      'mat-dialog-content input:not([type="file"]):not([readonly]), mat-dialog-content textarea, mat-dialog-content [role="combobox"]',
    );
    target?.focus({ preventScroll: true });
  }

  private focusFirstInvalidField() {
    const invalidField = this.guidedFields.find((field) => this.form.get(field.key)?.invalid);
    if (!invalidField) {
      return;
    }

    this.scrollToSection(invalidField.section?.trim() || 'General');

    requestAnimationFrame(() => {
      const target = this.host.nativeElement.querySelector<HTMLElement>(
        `[formcontrolname="${invalidField.key}"]`,
      );
      target?.focus({ preventScroll: true });
    });
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
