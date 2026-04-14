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

const INTEGRATION_CONFIGS: Record<string, EntityConfig> = {
  systems: {
    route: "systems",
    table: "integraciones.sistemas_externos",
    idColumn: "id_sistema_externo",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "tipo_sistema", "url_base", "activo"],
    filterColumns: ["tipo_sistema", "activo"],
    searchableColumns: ["codigo", "nombre", "url_base"],
  },
  syncs: {
    route: "syncs",
    table: "integraciones.sincronizaciones",
    idColumn: "id_sincronizacion",
    defaultOrderBy: "fecha_ejecucion",
    allowedColumns: [
      "id_sistema_externo",
      "modulo",
      "tipo_operacion",
      "id_registro_local",
      "id_registro_externo",
      "estado",
      "mensaje_resultado",
      "payload_enviado",
      "payload_recibido",
    ],
    filterColumns: ["id_sistema_externo", "modulo", "tipo_operacion", "estado"],
    searchableColumns: ["mensaje_resultado", "id_registro_externo"],
  },
};

class FlexibleDto {
  [key: string]: unknown;
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly db: DatabaseService) {}

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

  async createEntity(entity: string, payload: Record<string, unknown>) {
    const config = this.getConfig(entity);
    const data = pickAllowedValues(payload, config.allowedColumns);
    if (entity === "syncs") {
      data.payload_enviado = data.payload_enviado
        ? JSON.stringify(data.payload_enviado)
        : null;
      data.payload_recibido = data.payload_recibido
        ? JSON.stringify(data.payload_recibido)
        : null;
    }
    const query = buildInsertQuery(config.table, data, config.idColumn);
    const result = await this.db.query(query.text, query.values);
    return result.rows[0];
  }

  async updateEntity(entity: string, id: string, payload: Record<string, unknown>) {
    const config = this.getConfig(entity);
    const data = pickAllowedValues(payload, config.allowedColumns);
    if (entity === "syncs") {
      if (data.payload_enviado) {
        data.payload_enviado = JSON.stringify(data.payload_enviado);
      }
      if (data.payload_recibido) {
        data.payload_recibido = JSON.stringify(data.payload_recibido);
      }
    }
    const query = buildUpdateQuery(config.table, data, config.idColumn, id);
    const result = await this.db.query(query.text, query.values);
    return result.rows[0];
  }

  private getConfig(entity: string) {
    const config = INTEGRATION_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de integración no soportada: ${entity}`);
    }
    return config;
  }
}

@ApiTags("Integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("reports.read")
@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get(":entity")
  @ApiOperation({ summary: "Listar sistemas externos y sincronizaciones" })
  async listEntity(@Param("entity") entity: string, @Query() query: Record<string, unknown>) {
    return this.integrationsService.listEntity(entity, query);
  }

  @Get(":entity/:id")
  @ApiOperation({ summary: "Consultar sistema externo o sincronización" })
  async getEntity(@Param("entity") entity: string, @Param("id") id: string) {
    return this.integrationsService.getEntity(entity, id);
  }

  @Post(":entity")
  @ApiOperation({ summary: "Crear sistema externo o sincronización" })
  async createEntity(@Param("entity") entity: string, @Body() payload: FlexibleDto) {
    return this.integrationsService.createEntity(entity, payload);
  }

  @Patch(":entity/:id")
  @ApiOperation({ summary: "Actualizar sistema externo o sincronización" })
  async updateEntity(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
  ) {
    return this.integrationsService.updateEntity(entity, id, payload);
  }
}

@Module({
  imports: [DatabaseModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
