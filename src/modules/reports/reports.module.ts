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
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async inventory(query: Record<string, unknown>) {
    const values: unknown[] = [];
    const where: string[] = [];
    for (const field of ["id_bodega", "id_producto"]) {
      if (query[field]) {
        values.push(query[field]);
        where.push(`${field} = $${values.length}`);
      }
    }

    const result = await this.db.query(
      `
      SELECT *
      FROM inventario.v_stock_actual
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY nombre_producto
      `,
      values,
    );
    return result.rows;
  }

  async expirations() {
    const result = await this.db.query(
      `
      SELECT l.*, p.sku, p.nombre
      FROM inventario.lotes_producto l
      JOIN maestros.productos p ON p.id_producto = l.id_producto
      WHERE l.fecha_vencimiento IS NOT NULL
      ORDER BY l.fecha_vencimiento
      `,
    );
    return result.rows;
  }

  async traceability(query: Record<string, unknown>) {
    const result = await this.db.query(
      `
      SELECT m.*, d.tipo_documento, d.numero_documento, p.sku, p.nombre
      FROM inventario.movimientos_inventario m
      JOIN inventario.documentos_movimiento_inventario d
        ON d.id_documento_movimiento_inventario = m.id_documento_movimiento_inventario
      JOIN maestros.productos p ON p.id_producto = m.id_producto
      WHERE ($1::uuid IS NULL OR m.id_producto = $1)
      ORDER BY m.fecha_movimiento DESC
      LIMIT 500
      `,
      [query.id_producto ?? null],
    );
    return result.rows;
  }

  async purchases() {
    const result = await this.db.query(
      `
      SELECT oc.*, t.nombre_comercial, t.razon_social
      FROM compras.ordenes_compra oc
      JOIN maestros.terceros t ON t.id_tercero = oc.id_proveedor
      ORDER BY oc.fecha_emision DESC
      LIMIT 200
      `,
    );
    return result.rows;
  }

  async sales() {
    const result = await this.db.query(
      `
      SELECT v.*
      FROM ventas.ventas v
      ORDER BY v.fecha_venta DESC
      LIMIT 200
      `,
    );
    return result.rows;
  }

  async audit() {
    const result = await this.db.query(
      `
      SELECT *
      FROM auditoria.eventos_auditoria
      ORDER BY fecha_evento DESC
      LIMIT 500
      `,
    );
    return result.rows;
  }
}

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("reports.read")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("inventory")
  @ApiOperation({ summary: "Reporte de inventario vigente" })
  async inventory(@Query() query: Record<string, unknown>) {
    return this.reportsService.inventory(query);
  }

  @Get("expirations")
  @ApiOperation({ summary: "Reporte de lotes y vencimientos" })
  async expirations() {
    return this.reportsService.expirations();
  }

  @Get("traceability")
  @ApiOperation({ summary: "Reporte de trazabilidad y kardex" })
  async traceability(@Query() query: Record<string, unknown>) {
    return this.reportsService.traceability(query);
  }

  @Get("purchases")
  @ApiOperation({ summary: "Reporte de compras" })
  async purchases() {
    return this.reportsService.purchases();
  }

  @Get("sales")
  @ApiOperation({ summary: "Reporte de ventas" })
  async sales() {
    return this.reportsService.sales();
  }

  @Get("audit")
  @ApiOperation({ summary: "Reporte de auditoría" })
  async audit() {
    return this.reportsService.audit();
  }
}

@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
