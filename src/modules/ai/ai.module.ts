import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
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
  buildListQuery,
  pickAllowedValues,
} from "../../common/sql.utils";
import { DatabaseModule } from "../../database/database.module";
import { DatabaseService } from "../../database/database.service";

const AI_ENTITY_CONFIGS: Record<string, EntityConfig> = {
  models: {
    route: "models",
    table: "ia.modelos_ia",
    idColumn: "id_modelo_ia",
    defaultOrderBy: "fecha_entrenamiento",
    allowedColumns: [],
    filterColumns: ["tipo_modelo", "activo"],
    searchableColumns: ["codigo", "nombre", "version", "descripcion"],
  },
  forecasts: {
    route: "forecasts",
    table: "ia.pronosticos_demanda",
    idColumn: "id_pronostico_demanda",
    defaultOrderBy: "generado_en",
    allowedColumns: [],
    filterColumns: ["id_producto", "id_bodega"],
    searchableColumns: [],
  },
  replenishments: {
    route: "replenishments",
    table: "ia.recomendaciones_reposicion",
    idColumn: "id_recomendacion_reposicion",
    defaultOrderBy: "fecha_recomendacion",
    allowedColumns: [],
    filterColumns: ["id_producto", "id_bodega", "tipo_recomendacion", "atendida"],
    searchableColumns: ["justificacion"],
  },
  anomalies: {
    route: "anomalies",
    table: "ia.anomalias_inventario",
    idColumn: "id_anomalia_inventario",
    defaultOrderBy: "detectada_en",
    allowedColumns: [],
    filterColumns: ["id_producto", "id_bodega", "estado", "tipo_anomalia"],
    searchableColumns: ["descripcion"],
  },
  classifications: {
    route: "classifications",
    table: "ia.sugerencias_clasificacion_producto",
    idColumn: "id_sugerencia_clasificacion_producto",
    defaultOrderBy: "generado_en",
    allowedColumns: [],
    filterColumns: ["id_producto"],
    searchableColumns: [],
  },
  extractions: {
    route: "extractions",
    table: "ia.extracciones_documento",
    idColumn: "id_extraccion_documento",
    defaultOrderBy: "generado_en",
    allowedColumns: [],
    filterColumns: ["tipo_documento", "validada"],
    searchableColumns: ["nombre_archivo", "url_archivo"],
  },
};

class FlexibleDto {
  [key: string]: unknown;
}

@Injectable()
export class AiService {
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

  async forecastDemand(
    input: {
      id_producto: string;
      id_bodega?: string | null;
      days_history?: number;
      days_forecast?: number;
    },
    actor?: AuthUser,
  ) {
    const modelId = await this.ensureModel(
      "FORECAST-DEFAULT",
      "Pronóstico base",
      "PRONOSTICO_DEMANDA",
    );
    const daysHistory = input.days_history ?? 30;
    const daysForecast = input.days_forecast ?? 15;
    const result = await this.db.query<{
      total_vendido: number;
    }>(
      `
      SELECT coalesce(sum(d.cantidad), 0) AS total_vendido
      FROM ventas.detalles_venta d
      JOIN ventas.ventas v ON v.id_venta = d.id_venta
      WHERE d.id_producto = $1
        AND ($2::uuid IS NULL OR v.id_bodega = $2)
        AND v.fecha_venta >= now() - ($3 || ' days')::interval
        AND v.estado <> 'ANULADA'
      `,
      [input.id_producto, input.id_bodega ?? null, daysHistory],
    );

    const averageDaily = Number(result.rows[0].total_vendido) / daysHistory;
    const estimated = Number((averageDaily * daysForecast).toFixed(4));
    const saved = await this.db.query(
      `
      INSERT INTO ia.pronosticos_demanda (
        id_modelo_ia, id_producto, id_bodega, periodo_desde, periodo_hasta,
        demanda_estimada, intervalo_inferior, intervalo_superior, nivel_confianza,
        variables_utilizadas, generado_por, observaciones
      )
      VALUES (
        $1, $2, $3, current_date - $4::int, current_date + $5::int,
        $6, $7, $8, $9, $10::jsonb, $11, $12
      )
      RETURNING *
      `,
      [
        modelId,
        input.id_producto,
        input.id_bodega ?? null,
        daysHistory,
        daysForecast,
        estimated,
        Number((estimated * 0.9).toFixed(4)),
        Number((estimated * 1.1).toFixed(4)),
        0.65,
        JSON.stringify({ days_history: daysHistory, days_forecast: daysForecast }),
        actor?.id_usuario ?? null,
        "Promedio móvil simple",
      ],
    );
    return saved.rows[0];
  }

  async recommendReplenishment(
    input: { id_producto: string; id_bodega: string },
    actor?: AuthUser,
  ) {
    const modelId = await this.ensureModel(
      "REPLENISH-DEFAULT",
      "Reposición base",
      "REPOSICION",
    );
    const product = await this.db.query<{
      punto_reorden: number | null;
      stock_minimo: number;
      dias_cobertura_objetivo: number | null;
    }>(
      `
      SELECT punto_reorden, stock_minimo, dias_cobertura_objetivo
      FROM maestros.productos
      WHERE id_producto = $1
      `,
      [input.id_producto],
    );
    const forecast = await this.forecastDemand(
      {
        id_producto: input.id_producto,
        id_bodega: input.id_bodega,
        days_history: 30,
        days_forecast: product.rows[0]?.dias_cobertura_objetivo ?? 15,
      },
      actor,
    );
    const stock = await this.db.query<{
      disponible: number;
      reservado: number;
      transito: number;
    }>(
      `
      SELECT
        coalesce(sum(cantidad_disponible), 0) AS disponible,
        coalesce(sum(cantidad_reservada), 0) AS reservado,
        coalesce(sum(cantidad_transito_entrada), 0) AS transito
      FROM inventario.existencias
      WHERE id_producto = $1 AND id_bodega = $2
      `,
      [input.id_producto, input.id_bodega],
    );

    const available = Number(stock.rows[0].disponible) - Number(stock.rows[0].reservado);
    const target =
      Number(product.rows[0]?.punto_reorden ?? product.rows[0]?.stock_minimo ?? 0) +
      Number(forecast.demanda_estimada ?? 0) -
      available -
      Number(stock.rows[0].transito);
    const suggested = Math.max(0, Number(target.toFixed(4)));

    const saved = await this.db.query(
      `
      INSERT INTO ia.recomendaciones_reposicion (
        id_modelo_ia, id_producto, id_bodega, cantidad_sugerida,
        tipo_recomendacion, justificacion, datos_base
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
      `,
      [
        modelId,
        input.id_producto,
        input.id_bodega,
        suggested,
        suggested > 0 ? "COMPRA" : "NINGUNA",
        "Demanda estimada + punto de reorden - disponibilidad actual",
        JSON.stringify({
          disponible: stock.rows[0].disponible,
          reservado: stock.rows[0].reservado,
          transito: stock.rows[0].transito,
          forecast: forecast.demanda_estimada,
        }),
      ],
    );
    return saved.rows[0];
  }

  async detectAnomalies(
    input: { id_producto?: string | null; id_bodega?: string | null },
    actor?: AuthUser,
  ) {
    const modelId = await this.ensureModel(
      "ANOMALY-DEFAULT",
      "Anomalías base",
      "ANOMALIAS",
    );
    const result = await this.db.query<{
      id_producto: string;
      id_bodega: string;
      total_ajustes: number;
    }>(
      `
      SELECT dai.id_producto, ai.id_bodega, count(*)::int AS total_ajustes
      FROM inventario.detalles_ajuste_inventario dai
      JOIN inventario.ajustes_inventario ai
        ON ai.id_ajuste_inventario = dai.id_ajuste_inventario
      WHERE ($1::uuid IS NULL OR dai.id_producto = $1)
        AND ($2::uuid IS NULL OR ai.id_bodega = $2)
      GROUP BY dai.id_producto, ai.id_bodega
      HAVING count(*) >= 2
      `,
      [input.id_producto ?? null, input.id_bodega ?? null],
    );

    const anomalies = [];
    for (const row of result.rows) {
      const saved = await this.db.query(
        `
        INSERT INTO ia.anomalias_inventario (
          id_modelo_ia, id_producto, id_bodega, tipo_anomalia, severidad,
          puntaje_anomalia, descripcion, evidencia_datos, responsable_id_usuario
        )
        VALUES ($1, $2, $3, 'AJUSTE_REPETITIVO', 'MEDIA', $4, $5, $6::jsonb, $7)
        RETURNING *
        `,
        [
          modelId,
          row.id_producto,
          row.id_bodega,
          Math.min(1, Number(row.total_ajustes) / 10),
          "Ajustes repetitivos detectados para el producto",
          JSON.stringify({ total_ajustes: row.total_ajustes }),
          actor?.id_usuario ?? null,
        ],
      );
      anomalies.push(saved.rows[0]);
    }
    return anomalies;
  }

  async classifyProduct(productId: string, actor?: AuthUser) {
    const modelId = await this.ensureModel(
      "CLASSIFY-DEFAULT",
      "Clasificación base",
      "CLASIFICACION",
    );
    const productResult = await this.db.query<{ nombre: string; descripcion: string | null }>(
      "SELECT nombre, descripcion FROM maestros.productos WHERE id_producto = $1",
      [productId],
    );
    const product = productResult.rows[0];
    if (!product) {
      throw new BadRequestException("Producto no encontrado");
    }

    const text = `${product.nombre} ${product.descripcion ?? ""}`.toLowerCase();
    const categories = await this.db.query<{
      id_categoria_producto: string;
      nombre: string;
    }>("SELECT id_categoria_producto, nombre FROM maestros.categorias_producto WHERE activo = true");

    let selectedCategory: string | null = null;
    for (const category of categories.rows) {
      if (text.includes(category.nombre.toLowerCase())) {
        selectedCategory = category.id_categoria_producto;
        break;
      }
    }

    const suggestedTags = [
      text.includes("lubric") ? "lubricante" : null,
      text.includes("preserv") ? "proteccion" : null,
      text.includes("kit") ? "kit" : null,
    ].filter(Boolean);

    const saved = await this.db.query(
      `
      INSERT INTO ia.sugerencias_clasificacion_producto (
        id_modelo_ia, id_producto, id_categoria_sugerida,
        etiquetas_sugeridas, atributos_sugeridos, puntaje_confianza,
        aceptada, aceptada_por, fecha_revision
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, null, $7, null)
      RETURNING *
      `,
      [
        modelId,
        productId,
        selectedCategory,
        JSON.stringify(suggestedTags),
        JSON.stringify({ source: "keyword-match" }),
        selectedCategory ? 0.72 : 0.41,
        actor?.id_usuario ?? null,
      ],
    );
    return saved.rows[0];
  }

  async extractDocument(
    input: {
      tipo_documento: string;
      nombre_archivo?: string;
      url_archivo: string;
      raw_text?: string;
    },
    actor?: AuthUser,
  ) {
    const modelId = await this.ensureModel(
      "EXTRACT-DEFAULT",
      "Extracción base",
      "EXTRACCION_DOCUMENTOS",
    );
    const text = input.raw_text ?? "";
    const fields = {
      numero_documento:
        text.match(/(?:factura|documento|invoice)[^0-9A-Z]*([A-Z0-9-]+)/i)?.[1] ?? null,
      total:
        text.match(/(?:total|valor total)[^0-9]*([0-9]+(?:[.,][0-9]{2})?)/i)?.[1] ??
        null,
      tercero:
        text.match(/(?:proveedor|cliente|razon social)[:\s]+([A-Za-z0-9 .-]+)/i)?.[1] ??
        null,
    };

    const saved = await this.db.query(
      `
      INSERT INTO ia.extracciones_documento (
        id_modelo_ia, tipo_documento, nombre_archivo, url_archivo,
        campos_extraidos, porcentaje_confianza, validada, validada_por, observaciones
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, false, $7, $8)
      RETURNING *
      `,
      [
        modelId,
        input.tipo_documento,
        input.nombre_archivo ?? null,
        input.url_archivo,
        JSON.stringify(fields),
        Object.values(fields).some(Boolean) ? 0.67 : 0.2,
        actor?.id_usuario ?? null,
        "Extracción por expresiones regulares",
      ],
    );
    return saved.rows[0];
  }

  private async ensureModel(codigo: string, nombre: string, tipoModelo: string) {
    const existing = await this.db.query<{ id_modelo_ia: string }>(
      "SELECT id_modelo_ia FROM ia.modelos_ia WHERE codigo = $1",
      [codigo],
    );
    if (existing.rows.length) {
      return existing.rows[0].id_modelo_ia;
    }

    const created = await this.db.query<{ id_modelo_ia: string }>(
      `
      INSERT INTO ia.modelos_ia (codigo, nombre, tipo_modelo, version, descripcion, activo)
      VALUES ($1, $2, $3, '1.0.0', $4, true)
      RETURNING id_modelo_ia
      `,
      [codigo, nombre, tipoModelo, "Modelo MVP explicable"],
    );
    return created.rows[0].id_modelo_ia;
  }

  private getConfig(entity: string) {
    const config = AI_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad IA no soportada: ${entity}`);
    }
    return config;
  }
}

@ApiTags("AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("ai.manage")
@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get(":entity")
  @ApiOperation({ summary: "Listar modelos y resultados de IA" })
  async listEntity(@Param("entity") entity: string, @Query() query: Record<string, unknown>) {
    return this.aiService.listEntity(entity, query);
  }

  @Post("forecast-demand")
  @ApiOperation({ summary: "Generar pronóstico básico de demanda" })
  async forecastDemand(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.aiService.forecastDemand(
      payload as unknown as { id_producto: string; id_bodega?: string | null },
      user,
    );
  }

  @Post("replenishment")
  @ApiOperation({ summary: "Generar recomendación de reposición" })
  async recommendReplenishment(
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.aiService.recommendReplenishment(
      payload as unknown as { id_producto: string; id_bodega: string },
      user,
    );
  }

  @Post("detect-anomalies")
  @ApiOperation({ summary: "Detectar anomalías operativas" })
  async detectAnomalies(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.aiService.detectAnomalies(
      payload as unknown as { id_producto?: string | null; id_bodega?: string | null },
      user,
    );
  }

  @Post("classify-product/:id")
  @ApiOperation({ summary: "Generar clasificación asistida de producto" })
  async classifyProduct(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.aiService.classifyProduct(id, user);
  }

  @Post("extract-document")
  @ApiOperation({ summary: "Extraer datos básicos de documento" })
  async extractDocument(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.aiService.extractDocument(
      payload as unknown as { tipo_documento: string; url_archivo: string; raw_text?: string },
      user,
    );
  }
}

@Module({
  imports: [DatabaseModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
