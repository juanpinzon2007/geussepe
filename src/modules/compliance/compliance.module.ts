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
import { AuthUser, CurrentUser } from "../../common/current-user.decorator";
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
import { AuditModule, AuditService } from "../audit/audit.module";

const COMPLIANCE_ENTITY_CONFIGS: Record<string, EntityConfig> = {
  "privacy-policies": {
    route: "privacy-policies",
    table: "cumplimiento.politicas_tratamiento_datos",
    idColumn: "id_politica_tratamiento_datos",
    defaultOrderBy: "fecha_inicio_vigencia",
    allowedColumns: [
      "version",
      "titulo",
      "url_documento",
      "fecha_inicio_vigencia",
      "fecha_fin_vigencia",
      "activa",
    ],
    filterColumns: ["activa"],
    searchableColumns: ["version", "titulo"],
  },
  consents: {
    route: "consents",
    table: "cumplimiento.autorizaciones_datos_personales",
    idColumn: "id_autorizacion_datos_personales",
    defaultOrderBy: "fecha_autorizacion",
    allowedColumns: [
      "id_tercero",
      "id_politica_tratamiento_datos",
      "canal",
      "finalidad",
      "autorizada",
      "fecha_autorizacion",
      "evidencia",
      "ip_origen",
      "revocada",
      "fecha_revocatoria",
      "observaciones",
    ],
    filterColumns: ["id_tercero", "canal", "autorizada", "revocada"],
    searchableColumns: ["finalidad", "evidencia", "observaciones"],
  },
  "habeas-requests": {
    route: "habeas-requests",
    table: "cumplimiento.solicitudes_habeas_data",
    idColumn: "id_solicitud_habeas_data",
    defaultOrderBy: "fecha_radicacion",
    allowedColumns: [
      "id_tercero",
      "tipo_solicitud",
      "estado",
      "descripcion",
      "respuesta",
      "responsable_id_usuario",
      "observaciones",
      "fecha_respuesta",
    ],
    filterColumns: ["id_tercero", "tipo_solicitud", "estado"],
    searchableColumns: ["descripcion", "respuesta", "observaciones"],
  },
  "age-validations": {
    route: "age-validations",
    table: "cumplimiento.validaciones_mayoria_edad",
    idColumn: "id_validacion_mayoria_edad",
    defaultOrderBy: "fecha_validacion",
    allowedColumns: [
      "id_cliente",
      "id_venta",
      "id_pedido_ecommerce",
      "metodo_validacion",
      "resultado",
      "evidencia",
      "validado_por",
      "observaciones",
    ],
    filterColumns: ["id_cliente", "id_venta", "id_pedido_ecommerce", "resultado"],
    searchableColumns: ["metodo_validacion", "evidencia", "observaciones"],
  },
  "regulatory-alerts": {
    route: "regulatory-alerts",
    table: "cumplimiento.alertas_regulatorias",
    idColumn: "id_alerta_regulatoria",
    defaultOrderBy: "fecha_alerta",
    allowedColumns: [
      "id_producto",
      "id_lote_producto",
      "tipo_alerta",
      "severidad",
      "estado",
      "titulo",
      "descripcion",
      "fecha_cierre",
      "responsable_id_usuario",
      "observaciones",
    ],
    filterColumns: ["id_producto", "tipo_alerta", "severidad", "estado"],
    searchableColumns: ["titulo", "descripcion", "observaciones"],
  },
};

class FlexibleDto {
  [key: string]: unknown;
}

@Injectable()
export class ComplianceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

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
    if (entity === "age-validations" && actor) {
      data.validado_por = actor.id_usuario;
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

  async revokeConsent(consentId: string) {
    const result = await this.db.query(
      `
      UPDATE cumplimiento.autorizaciones_datos_personales
      SET revocada = true,
          fecha_revocatoria = now(),
          fecha_actualizacion = now()
      WHERE id_autorizacion_datos_personales = $1
      RETURNING *
      `,
      [consentId],
    );
    return result.rows[0];
  }

  async respondHabeasRequest(
    requestId: string,
    input: { respuesta: string; estado?: string },
    actor?: AuthUser,
  ) {
    const result = await this.db.query(
      `
      UPDATE cumplimiento.solicitudes_habeas_data
      SET respuesta = $2,
          estado = $3,
          fecha_respuesta = now(),
          responsable_id_usuario = $4,
          fecha_actualizacion = now()
      WHERE id_solicitud_habeas_data = $1
      RETURNING *
      `,
      [
        requestId,
        input.respuesta,
        input.estado ?? "RESPONDIDA",
        actor?.id_usuario ?? null,
      ],
    );
    return result.rows[0];
  }

  async closeRegulatoryAlert(alertId: string, actor?: AuthUser) {
    const result = await this.db.query(
      `
      UPDATE cumplimiento.alertas_regulatorias
      SET estado = 'CERRADA',
          fecha_cierre = now(),
          responsable_id_usuario = $2,
          fecha_actualizacion = now()
      WHERE id_alerta_regulatoria = $1
      RETURNING *
      `,
      [alertId, actor?.id_usuario ?? null],
    );
    return result.rows[0];
  }

  private getConfig(entity: string) {
    const config = COMPLIANCE_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(
        `Entidad de cumplimiento no soportada: ${entity}`,
      );
    }
    return config;
  }
}

@ApiTags("Compliance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("compliance.manage")
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get(":entity")
  @ApiOperation({ summary: "Listar registros de cumplimiento" })
  async listEntity(
    @Param("entity") entity: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.complianceService.listEntity(entity, query);
  }

  @Get(":entity/:id")
  @ApiOperation({ summary: "Consultar registro de cumplimiento" })
  async getEntity(@Param("entity") entity: string, @Param("id") id: string) {
    return this.complianceService.getEntity(entity, id);
  }

  @Post(":entity")
  @ApiOperation({ summary: "Crear registro de cumplimiento" })
  async createEntity(
    @Param("entity") entity: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.complianceService.createEntity(entity, payload, user);
  }

  @Patch(":entity/:id")
  @ApiOperation({ summary: "Actualizar registro de cumplimiento" })
  async updateEntity(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
  ) {
    return this.complianceService.updateEntity(entity, id, payload);
  }

  @Post("consents/:id/revoke")
  @ApiOperation({ summary: "Revocar autorización de datos personales" })
  async revokeConsent(@Param("id") id: string) {
    return this.complianceService.revokeConsent(id);
  }

  @Post("habeas-requests/:id/respond")
  @ApiOperation({ summary: "Responder solicitud de habeas data" })
  async respondHabeasRequest(
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.complianceService.respondHabeasRequest(
      id,
      payload as unknown as { respuesta: string; estado?: string },
      user,
    );
  }

  @Post("regulatory-alerts/:id/close")
  @ApiOperation({ summary: "Cerrar alerta regulatoria" })
  async closeRegulatoryAlert(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.complianceService.closeRegulatoryAlert(id, user);
  }
}

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
})
export class ComplianceModule {}
