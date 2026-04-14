import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ENTITY_OPTIONS, getEntityConfig } from '../../core/config/entity.registry';
import { EntityColumn } from '../../core/models/app.models';
import { ApiService } from '../../core/services/api.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { EntityFormDialogComponent } from '../../shared/ui/entity-form-dialog.component';
import { FormSectionCardComponent } from '../../shared/ui/form-section-card/form-section-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-entity-management-page',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    PageHeaderComponent,
    RouterLink,
    FormSectionCardComponent,
  ],
  template: `
    @if (config(); as entityConfig) {
      <section class="page-grid">
        <app-page-header
          [title]="entityConfig.title"
          [subtitle]="entityConfig.subtitle"
          [eyebrow]="entityConfig.badge ?? 'Gestion'"
        >
          <button mat-stroked-button type="button" (click)="loadData()">
            Actualizar
          </button>
          <button mat-flat-button color="primary" type="button" (click)="openCreate(entityConfig)">
            Nuevo registro
          </button>
        </app-page-header>

        <app-form-section-card
          eyebrow="Exploracion"
          title="Busqueda y relaciones"
          description="Filtra registros y navega entidades relacionadas con un patron visual mas limpio."
        >
          <div class="toolbar-actions">
            <label class="premium-search-field">
              <span class="cdk-visually-hidden">Buscar</span>
              <input
                matInput
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
                placeholder="Buscar por texto"
                (keyup.enter)="loadData()"
              >
            </label>

            <div class="premium-chip-links">
              @for (item of relatedEntities(); track item.endpoint) {
                <a
                  [routerLink]="['/app/entity', item.domain, item.key]"
                  class="premium-chip-link"
                >
                  {{ item.title }}
                </a>
              }
            </div>
          </div>
        </app-form-section-card>

        <app-form-section-card
          eyebrow="Tabla"
          [title]="entityConfig.title"
          description="Registros disponibles para consulta y edicion."
        >
          <div class="responsive-table">
            <table>
              <thead>
                <tr>
                  @for (column of entityConfig.columns; track column.key) {
                    <th>{{ column.label }}</th>
                  }
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track $index) {
                  <tr>
                    @for (column of entityConfig.columns; track column.key) {
                      <td>{{ renderCell(row, column) }}</td>
                    }
                    <td>
                      <button mat-button type="button" (click)="openEdit(entityConfig, row)">
                        Editar
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="entityConfig.columns.length + 1" class="empty-state">
                      No hay registros para esta entidad.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-form-section-card>
      </section>
    } @else {
      <app-form-section-card
        eyebrow="Error"
        title="Entidad no configurada"
        description="La ruta solicitada no existe dentro del registro declarativo del frontend."
      >
      </app-form-section-card>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityManagementPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly uiFeedback = inject(UiFeedbackService);

  readonly domain = signal('');
  readonly entity = signal('');
  readonly rows = signal<any[]>([]);
  readonly search = signal('');
  readonly config = computed(() => getEntityConfig(this.domain(), this.entity()));
  readonly relatedEntities = computed(() =>
    ENTITY_OPTIONS.filter((item) => item.domain === this.domain()),
  );

  constructor() {
    this.route.paramMap.subscribe((params) => {
      this.domain.set(params.get('domain') ?? '');
      this.entity.set(params.get('entity') ?? '');
      this.loadData();
    });
  }

  loadData() {
    const config = this.config();
    if (!config) {
      return;
    }

    this.api
      .get<any[]>(config.endpoint, {
        search: this.search(),
        limit: 50,
        page: 1,
      })
      .subscribe((rows) => this.rows.set(rows));
  }

  openCreate(config: NonNullable<ReturnType<EntityManagementPageComponent['config']>>) {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      data: {
        config,
        isCreate: true,
      },
    });

    dialogRef.afterClosed().subscribe((payload) => {
      if (!payload) {
        return;
      }

      this.api.post(config.endpoint, payload).subscribe(() => {
        this.uiFeedback.success('Registro creado');
        this.loadData();
      });
    });
  }

  openEdit(
    config: NonNullable<ReturnType<EntityManagementPageComponent['config']>>,
    row: Record<string, unknown>,
  ) {
    const id = this.resolveId(row, config.idKey);
    this.api.get<Record<string, unknown>>(`${config.endpoint}/${id}`).subscribe((record) => {
      const dialogRef = this.dialog.open(EntityFormDialogComponent, {
        data: {
          config,
          isCreate: false,
          initialValue: record,
        },
      });

      dialogRef.afterClosed().subscribe((payload) => {
        if (!payload) {
          return;
        }

        this.api.patch(`${config.endpoint}/${id}`, payload).subscribe(() => {
          this.uiFeedback.success('Registro actualizado');
          this.loadData();
        });
      });
    });
  }

  resolveId(row: Record<string, unknown>, idKey: string) {
    return row[idKey] as string;
  }

  renderCell(row: Record<string, unknown>, column: EntityColumn) {
    const value = row[column.key];
    if (column.type === 'boolean') {
      return value ? 'Si' : 'No';
    }

    if (column.type === 'date' && value) {
      return new Date(String(value)).toLocaleDateString('es-CO');
    }

    return value ?? '-';
  }
}
