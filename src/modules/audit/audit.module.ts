import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { CurrentUser, AuthUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Permissions, PermissionsGuard } from "../../common/guards/permissions.guard";
import {
  EntityConfig,
  buildInsertQuery,
  buildListQuery,
  buildUpdateQuery,
  pickAllowedValues,
} from "../../common/sql.utils";
import { DatabaseModule } from "../../database/database.module";
import { DatabaseService } from "../../database/database.service";

const AUDIT_ENTITY_CONFIGS: Record<string, EntityConfig> = {
  "approval-flows": {
    route: "approval-flows",
    table: "auditoria.flujos_aprobacion",
    idColumn: "id_flujo_aprobacion",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "tipo_documento", "descripcion", "activo"],
    filterColumns: ["tipo_documento", "activo"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  "approval-levels": {
    route: "approval-levels",
    table: "auditoria.niveles_flujo_aprobacion",
    idColumn: "id_nivel_flujo_aprobacion",
    defaultOrderBy: "nivel",
    allowedColumns: [
      "id_flujo_aprobacion",
      "nivel",
      "nombre",
      "id_rol_requerido",
      "monto_minimo",
      "monto_maximo",
      "obligatorio",
    ],
    filterColumns: ["id_flujo_aprobacion", "id_rol_requerido", "obligatorio"],
    searchableColumns: ["nombre"],
  },
  "approval-requests": {
    route: "approval-requests",
    table: "auditoria.solicitudes_aprobacion",
    idColumn: "id_solicitud_aprobacion",
    defaultOrderBy: "fecha_solicitud",
    allowedColumns: [
      "id_flujo_aprobacion",
      "tipo_documento",
      "id_documento",
      "estado",
      "monto_referencia",
      "solicitada_por",
      "observaciones",
    ],
    filterColumns: ["id_flujo_aprobacion", "tipo_documento", "estado"],
    searchableColumns: ["tipo_documento", "observaciones"],
  },
  "approval-responses": {
    route: "approval-responses",
    table: "auditoria.respuestas_aprobacion",
    idColumn: "id_respuesta_aprobacion",
    defaultOrderBy: "fecha_decision",
    allowedColumns: [
      "id_solicitud_aprobacion",
      "id_nivel_flujo_aprobacion",
      "id_usuario_aprobador",
      "decision",
      "fecha_decision",
      "observaciones",
    ],
    filterColumns: ["id_solicitud_aprobacion", "decision"],
    searchableColumns: ["observaciones"],
  },
  "operational-alerts": {
    route: "operational-alerts",
    table: "auditoria.alertas_operativas",
    idColumn: "id_alerta_operativa",
    defaultOrderBy: "fecha_generacion",
    allowedColumns: [
      "modulo",
      "tipo_alerta",
      "severidad",
      "estado",
      "titulo",
      "descripcion",
      "id_entidad_relacionada",
      "nombre_tabla_relacionada",
      "fecha_atencion",
      "atendida_por",
      "observaciones",
    ],
    filterColumns: ["modulo", "tipo_alerta", "severidad", "estado"],
    searchableColumns: ["titulo", "descripcion", "observaciones"],
  },
};

class FlexibleDto {
  [key: string]: unknown;
}

class CreateAuditEventDto {
  @IsString()
  modulo!: string;

  @IsString()
  nombre_tabla!: string;

  @IsOptional()
  @IsUUID()
  id_registro?: string;

  @IsIn([
    "INSERT",
    "UPDATE",
    "DELETE",
    "LOGIN",
    "LOGOUT",
    "APROBACION",
    "RECHAZO",
    "ANULACION",
    "OTRO",
  ])
  tipo_evento!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

type AuditEventType =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "APROBACION"
  | "RECHAZO"
  | "ANULACION"
  | "OTRO";

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async logEvent(input: {
    modulo: string;
    nombreTabla: string;
    idRegistro?: string | null;
    tipoEvento:
      | "INSERT"
      | "UPDATE"
      | "DELETE"
      | "LOGIN"
      | "LOGOUT"
      | "APROBACION"
      | "RECHAZO"
      | "ANULACION"
      | "OTRO";
    descripcion?: string | null;
    valorAnterior?: unknown;
    valorNuevo?: unknown;
    idUsuario?: string | null;
    direccionIp?: string | null;
    agenteUsuario?: string | null;
  }): Promise<void> {
    await this.db.query(
      `
      INSERT INTO auditoria.eventos_auditoria (
        modulo, nombre_tabla, id_registro, tipo_evento, descripcion,
        valor_anterior, valor_nuevo, id_usuario, direccion_ip, agente_usuario
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
      `,
      [
        input.modulo,
        input.nombreTabla,
        input.idRegistro ?? null,
        input.tipoEvento,
        input.descripcion ?? null,
        input.valorAnterior ? JSON.stringify(input.valorAnterior) : null,
        input.valorNuevo ? JSON.stringify(input.valorNuevo) : null,
        input.idUsuario ?? null,
        input.direccionIp ?? null,
        input.agenteUsuario ?? null,
      ],
    );
  }

  async listEvents(filters: { modulo?: string; tabla?: string; tipo?: string }) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filters.modulo) {
      values.push(filters.modulo);
      clauses.push(`modulo = $${values.length}`);
    }
    if (filters.tabla) {
      values.push(filters.tabla);
      clauses.push(`nombre_tabla = $${values.length}`);
    }
    if (filters.tipo) {
      values.push(filters.tipo);
      clauses.push(`tipo_evento = $${values.length}`);
    }

    const result = await this.db.query(
      `
      SELECT *
      FROM auditoria.eventos_auditoria
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY fecha_evento DESC
      LIMIT 500
      `,
      values,
    );
    return result.rows;
  }

  async listEntity(entity: string, query: Record<string, unknown>) {
    const config = this.getConfig(entity);
    const { page, limit, search, ...filters } = query;
    const sql = buildListQuery(config, {
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
      search: typeof search === "string" ? search : undefined,
      filters,
    });
    const result = await this.db.query(sql.text, sql.values);
    return result.rows;
  }

  async getEntity(entity: string, id: string) {
    const config = this.getConfig(entity);
    const result = await this.db.query(
      `SELECT * FROM ${config.table} WHERE ${config.idColumn} = $1`,
      [id],
    );
    return result.rows[0];
  }

  async createEntity(entity: string, payload: Record<string, unknown>, actor?: AuthUser) {
    const config = this.getConfig(entity);
    const data = pickAllowedValues(payload, config.allowedColumns);
    if (entity === "approval-requests" && actor) {
      data.solicitada_por = actor.id_usuario;
    }
    if (entity === "approval-responses" && actor) {
      data.id_usuario_aprobador = actor.id_usuario;
      data.fecha_decision = new Date().toISOString();
    }
    const query = buildInsertQuery(config.table, data, config.idColumn);
    const result = await this.db.query(query.text, query.values);
    return result.rows[0];
  }

  async updateEntity(entity: string, id: string, payload: Record<string, unknown>) {
    const config = this.getConfig(entity);
    const data = pickAllowedValues(payload, config.allowedColumns);
    const query = buildUpdateQuery(config.table, data, config.idColumn, id);
    const result = await this.db.query(query.text, query.values);
    return result.rows[0];
  }

  async respondApprovalRequest(
    requestId: string,
    input: {
      id_nivel_flujo_aprobacion: string;
      decision: "APROBADO" | "RECHAZADO";
      observaciones?: string;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const requestResult = await client.query(
        `
        SELECT *
        FROM auditoria.solicitudes_aprobacion
        WHERE id_solicitud_aprobacion = $1
        FOR UPDATE
        `,
        [requestId],
      );
      const request = requestResult.rows[0];
      if (!request) {
        throw new BadRequestException("Solicitud de aprobación no encontrada");
      }

      await client.query(
        `
        INSERT INTO auditoria.respuestas_aprobacion (
          id_solicitud_aprobacion, id_nivel_flujo_aprobacion,
          id_usuario_aprobador, decision, fecha_decision, observaciones
        )
        VALUES ($1, $2, $3, $4, now(), $5)
        `,
        [
          requestId,
          input.id_nivel_flujo_aprobacion,
          actor?.id_usuario ?? null,
          input.decision,
          input.observaciones ?? null,
        ],
      );

      const state = input.decision === "APROBADO" ? "APROBADA" : "RECHAZADA";
      const result = await client.query(
        `
        UPDATE auditoria.solicitudes_aprobacion
        SET estado = $2,
            fecha_actualizacion = now()
        WHERE id_solicitud_aprobacion = $1
        RETURNING *
        `,
        [requestId, state],
      );
      return result.rows[0];
    });
  }

  async attendOperationalAlert(alertId: string, actor?: AuthUser) {
    const result = await this.db.query(
      `
      UPDATE auditoria.alertas_operativas
      SET estado = 'ATENDIDA',
          fecha_atencion = now(),
          atendida_por = $2,
          fecha_actualizacion = now()
      WHERE id_alerta_operativa = $1
      RETURNING *
      `,
      [alertId, actor?.id_usuario ?? null],
    );
    return result.rows[0];
  }

  private getConfig(entity: string) {
    const config = AUDIT_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de auditoría no soportada: ${entity}`);
    }
    return config;
  }
}

@ApiTags("Audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("audit.read")
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("events")
  @ApiOperation({ summary: "Consultar eventos de auditoría" })
  async getEvents(
    @Query("modulo") modulo?: string,
    @Query("tabla") tabla?: string,
    @Query("tipo") tipo?: string,
  ) {
    return this.auditService.listEvents({ modulo, tabla, tipo });
  }

  @Post("events")
  @ApiOperation({ summary: "Registrar evento manual de auditoría" })
  async createEvent(
    @Body() dto: CreateAuditEventDto,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.auditService.logEvent({
      modulo: dto.modulo,
      nombreTabla: dto.nombre_tabla,
      idRegistro: dto.id_registro ?? null,
      tipoEvento: dto.tipo_evento as AuditEventType,
      descripcion: dto.descripcion ?? null,
      idUsuario: user?.id_usuario ?? null,
    });

    return { message: "Evento registrado" };
  }

  @Get(":entity")
  @ApiOperation({ summary: "Listar entidades de auditoría y aprobación" })
  async listEntity(
    @Param("entity") entity: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.auditService.listEntity(entity, query);
  }

  @Get(":entity/:id")
  @ApiOperation({ summary: "Consultar entidad de auditoría y aprobación" })
  async getEntity(@Param("entity") entity: string, @Param("id") id: string) {
    return this.auditService.getEntity(entity, id);
  }

  @Post(":entity")
  @ApiOperation({ summary: "Crear entidad de auditoría y aprobación" })
  async createEntity(
    @Param("entity") entity: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auditService.createEntity(entity, payload, user);
  }

  @Patch(":entity/:id")
  @ApiOperation({ summary: "Actualizar entidad de auditoría y aprobación" })
  async updateEntity(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
  ) {
    return this.auditService.updateEntity(entity, id, payload);
  }

  @Post("approval-requests/:id/respond")
  @ApiOperation({ summary: "Responder solicitud de aprobación" })
  async respondApprovalRequest(
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auditService.respondApprovalRequest(
      id,
      payload as unknown as {
        id_nivel_flujo_aprobacion: string;
        decision: "APROBADO" | "RECHAZADO";
        observaciones?: string;
      },
      user,
    );
  }

  @Post("operational-alerts/:id/attend")
  @ApiOperation({ summary: "Marcar alerta operativa como atendida" })
  async attendAlert(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.auditService.attendOperationalAlert(id, user);
  }
}

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
