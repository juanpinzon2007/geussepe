import {
  Controller,
  Get,
  Injectable,
  Module,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Permissions, PermissionsGuard } from "../../common/guards/permissions.guard";
import { DatabaseModule } from "../../database/database.module";
import { DatabaseService } from "../../database/database.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  async dashboard(query: Record<string, unknown>) {
    const dateFrom = (query.fecha_desde as string | undefined) ?? "1970-01-01";
    const dateTo = (query.fecha_hasta as string | undefined) ?? new Date().toISOString();

    const [inventory, sales, purchases, returns] = await Promise.all([
      this.db.query(
        `
        SELECT
          count(*) AS referencias_con_stock,
          coalesce(sum(cantidad_disponible), 0) AS unidades_disponibles,
          coalesce(sum(cantidad_bloqueada), 0) AS unidades_bloqueadas,
          coalesce(sum(cantidad_reservada), 0) AS unidades_reservadas
        FROM inventario.v_stock_actual
        `,
      ),
      this.db.query(
        `
        SELECT
          count(*) AS ventas,
          coalesce(sum(total_general), 0) AS total_vendido
        FROM ventas.ventas
        WHERE fecha_venta BETWEEN $1 AND $2
          AND estado <> 'ANULADA'
        `,
        [dateFrom, dateTo],
      ),
      this.db.query(
        `
        SELECT
          count(*) AS compras,
          coalesce(sum(total_general), 0) AS total_comprado
        FROM compras.ordenes_compra
        WHERE fecha_emision BETWEEN $1 AND $2
          AND estado <> 'CANCELADA'
        `,
        [dateFrom, dateTo],
      ),
      this.db.query(
        `
        SELECT
          count(*) AS devoluciones_cliente,
          coalesce(sum(d.cantidad), 0) AS unidades_devueltas
        FROM ventas.devoluciones_cliente dc
        LEFT JOIN ventas.detalles_devolucion_cliente d
          ON d.id_devolucion_cliente = dc.id_devolucion_cliente
        WHERE dc.fecha_radicacion BETWEEN $1 AND $2
        `,
        [dateFrom, dateTo],
      ),
    ]);

    return {
      period: { from: dateFrom, to: dateTo },
      inventory: inventory.rows[0],
      sales: sales.rows[0],
      purchases: purchases.rows[0],
      returns: returns.rows[0],
    };
  }

  async rotation(query: Record<string, unknown>) {
    const result = await this.db.query(
      `
      SELECT p.id_producto, p.sku, p.nombre,
             coalesce(sum(dv.cantidad), 0) AS unidades_vendidas,
             coalesce(avg(vs.cantidad_disponible), 0) AS stock_promedio
      FROM maestros.productos p
      LEFT JOIN ventas.detalles_venta dv ON dv.id_producto = p.id_producto
      LEFT JOIN ventas.ventas v ON v.id_venta = dv.id_venta AND v.estado <> 'ANULADA'
      LEFT JOIN inventario.v_stock_actual vs ON vs.id_producto = p.id_producto
      GROUP BY p.id_producto, p.sku, p.nombre
      ORDER BY unidades_vendidas DESC
      LIMIT 100
      `,
    );
    return result.rows;
  }

  async stockAlerts() {
    const result = await this.db.query(
      `
      SELECT
        vs.id_producto,
        vs.sku,
        vs.nombre_producto,
        vs.id_bodega,
        vs.codigo_bodega,
        vs.nombre_bodega,
        sum(vs.cantidad_disponible) AS cantidad_disponible,
        sum(vs.cantidad_reservada) AS cantidad_reservada,
        sum(vs.cantidad_bloqueada) AS cantidad_bloqueada,
        p.stock_minimo,
        p.stock_maximo,
        CASE
          WHEN coalesce(p.stock_maximo, 0) > 0
            AND sum(vs.cantidad_disponible) >= p.stock_maximo
            THEN 'SOBRESTOCK'
          ELSE 'STOCK_BAJO'
        END AS tipo_alerta
      FROM inventario.v_stock_actual vs
      INNER JOIN maestros.productos p
        ON p.id_producto = vs.id_producto
      GROUP BY
        vs.id_producto,
        vs.sku,
        vs.nombre_producto,
        vs.id_bodega,
        vs.codigo_bodega,
        vs.nombre_bodega,
        p.stock_minimo,
        p.stock_maximo
      HAVING
        (coalesce(p.stock_minimo, 0) > 0 AND sum(vs.cantidad_disponible) <= p.stock_minimo)
        OR (coalesce(p.stock_maximo, 0) > 0 AND sum(vs.cantidad_disponible) >= p.stock_maximo)
      ORDER BY vs.nombre_producto, vs.nombre_bodega
      `,
    );
    return result.rows;
  }
}

@ApiTags("Analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("reports.read")
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Consultar tablero general de indicadores" })
  async dashboard(@Query() query: Record<string, unknown>) {
    return this.analyticsService.dashboard(query);
  }

  @Get("rotation")
  @ApiOperation({ summary: "Consultar rotación de productos" })
  async rotation(@Query() query: Record<string, unknown>) {
    return this.analyticsService.rotation(query);
  }

  @Get("stock-alerts")
  @ApiOperation({ summary: "Consultar alertas de stock bajo o sobrestock" })
  async stockAlerts() {
    return this.analyticsService.stockAlerts();
  }
}

@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
