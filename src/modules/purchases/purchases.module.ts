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
import { InventoryModule, InventoryService } from "../inventory/inventory.module";

const PURCHASE_ENTITY_CONFIGS: Record<string, EntityConfig> = {
  "payment-terms": {
    route: "payment-terms",
    table: "compras.condiciones_pago",
    idColumn: "id_condicion_pago",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "dias_credito", "descripcion", "activa"],
    filterColumns: ["activa"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  invoices: {
    route: "invoices",
    table: "compras.facturas_compra",
    idColumn: "id_factura_compra",
    defaultOrderBy: "fecha_emision",
    allowedColumns: [
      "id_proveedor",
      "id_orden_compra",
      "id_recepcion_compra",
      "tipo_documento",
      "prefijo",
      "numero_documento",
      "cufe_cuds",
      "fecha_emision",
      "fecha_vencimiento",
      "subtotal",
      "total_descuento",
      "total_impuestos",
      "total_general",
      "moneda",
      "estado",
      "xml_dian_url",
      "pdf_url",
      "hash_documento",
      "observaciones",
    ],
    filterColumns: ["id_proveedor", "id_orden_compra", "estado", "tipo_documento"],
    searchableColumns: ["numero_documento", "prefijo", "cufe_cuds"],
  },
};

class FlexibleDto {
  [key: string]: unknown;
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
    private readonly inventoryService: InventoryService,
  ) {}

  async listEntity(entity: string, query: Record<string, unknown>) {
    const config = PURCHASE_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de compras no soportada: ${entity}`);
    }
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
    const config = PURCHASE_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de compras no soportada: ${entity}`);
    }
    const result = await this.db.query(
      `SELECT * FROM ${config.table} WHERE ${config.idColumn} = $1`,
      [id],
    );
    return result.rows[0];
  }

  async createEntity(entity: string, payload: Record<string, unknown>) {
    const config = PURCHASE_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de compras no soportada: ${entity}`);
    }
    const data = pickAllowedValues(payload, config.allowedColumns);
    const query = buildInsertQuery(config.table, data, config.idColumn);
    const result = await this.db.query(query.text, query.values);
    return result.rows[0];
  }

  async updateEntity(entity: string, id: string, payload: Record<string, unknown>) {
    const config = PURCHASE_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de compras no soportada: ${entity}`);
    }
    const data = pickAllowedValues(payload, config.allowedColumns);
    const query = buildUpdateQuery(config.table, data, config.idColumn, id);
    const result = await this.db.query(query.text, query.values);
    return result.rows[0];
  }

  async createOrder(
    input: {
      prefijo?: string;
      numero_orden?: string;
      id_proveedor: string;
      id_bodega_destino: string;
      id_condicion_pago?: string;
      id_moneda: string;
      tasa_cambio?: number;
      fecha_entrega_estimada?: string;
      observaciones?: string;
      detalles: Array<{
        id_producto: string;
        id_producto_embalaje?: string | null;
        cantidad: number;
        costo_unitario: number;
        porcentaje_descuento?: number;
        porcentaje_impuesto?: number;
        observaciones?: string;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const totals = this.calculateTotals(input.detalles);
      const header = await client.query(
        `
        INSERT INTO compras.ordenes_compra (
          prefijo, numero_orden, id_proveedor, id_bodega_destino, id_condicion_pago,
          id_moneda, tasa_cambio, estado, fecha_entrega_estimada, subtotal,
          total_descuento, total_impuestos, total_general, observaciones, creado_por
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'BORRADOR', $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
        `,
        [
          input.prefijo ?? "OC",
          input.numero_orden ?? this.generateNumber("OC"),
          input.id_proveedor,
          input.id_bodega_destino,
          input.id_condicion_pago ?? null,
          input.id_moneda,
          input.tasa_cambio ?? 1,
          input.fecha_entrega_estimada ?? null,
          totals.subtotal,
          totals.total_descuento,
          totals.total_impuestos,
          totals.total_general,
          input.observaciones ?? null,
          actor?.id_usuario ?? null,
        ],
      );

      for (const detail of input.detalles) {
        const lineTotals = this.calculateLineTotals(detail);
        await client.query(
          `
          INSERT INTO compras.detalles_orden_compra (
            id_orden_compra, id_producto, id_producto_embalaje, cantidad,
            costo_unitario, porcentaje_descuento, porcentaje_impuesto,
            subtotal, total, observaciones
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            header.rows[0].id_orden_compra,
            detail.id_producto,
            detail.id_producto_embalaje ?? null,
            detail.cantidad,
            detail.costo_unitario,
            detail.porcentaje_descuento ?? 0,
            detail.porcentaje_impuesto ?? 0,
            lineTotals.subtotal,
            lineTotals.total,
            detail.observaciones ?? null,
          ],
        );
      }

      return header.rows[0];
    });
  }

  async approveOrder(orderId: string, actor?: AuthUser) {
    const result = await this.db.query(
      `
      UPDATE compras.ordenes_compra
      SET estado = 'APROBADA',
          aprobado_por = $2,
          fecha_aprobacion = now(),
          fecha_actualizacion = now()
      WHERE id_orden_compra = $1
      RETURNING *
      `,
      [orderId, actor?.id_usuario ?? null],
    );
    return result.rows[0];
  }

  async cancelOrder(orderId: string, actor?: AuthUser) {
    const result = await this.db.query(
      `
      UPDATE compras.ordenes_compra
      SET estado = 'CANCELADA',
          fecha_actualizacion = now(),
          observaciones = concat(coalesce(observaciones, ''), ' | Cancelada por ', $2)
      WHERE id_orden_compra = $1
      RETURNING *
      `,
      [orderId, actor?.nombre_usuario ?? "sistema"],
    );
    return result.rows[0];
  }

  async createReception(
    input: {
      prefijo?: string;
      numero_recepcion?: string;
      id_orden_compra?: string;
      id_proveedor: string;
      id_bodega: string;
      numero_factura_proveedor?: string;
      observaciones?: string;
      detalles: Array<{
        id_detalle_orden_compra?: string | null;
        id_producto: string;
        id_ubicacion?: string | null;
        cantidad_recibida: number;
        cantidad_aceptada?: number;
        cantidad_rechazada?: number;
        costo_unitario: number;
        porcentaje_impuesto?: number;
        numero_lote?: string;
        fecha_fabricacion?: string | null;
        fecha_vencimiento?: string | null;
        observaciones?: string;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const header = await client.query(
        `
        INSERT INTO compras.recepciones_compra (
          prefijo, numero_recepcion, id_orden_compra, id_proveedor, id_bodega,
          estado, recibido_por, numero_factura_proveedor, observaciones
        )
        VALUES ($1, $2, $3, $4, $5, 'PENDIENTE_VALIDACION', $6, $7, $8)
        RETURNING *
        `,
        [
          input.prefijo ?? "RC",
          input.numero_recepcion ?? this.generateNumber("RC"),
          input.id_orden_compra ?? null,
          input.id_proveedor,
          input.id_bodega,
          actor?.id_usuario ?? null,
          input.numero_factura_proveedor ?? null,
          input.observaciones ?? null,
        ],
      );

      for (const detail of input.detalles) {
        let lotId: string | null = null;
        if (detail.numero_lote) {
          const lot = await this.inventoryService.ensureLot(client, {
            id_producto: detail.id_producto,
            numero_lote: detail.numero_lote,
            fecha_fabricacion: detail.fecha_fabricacion ?? null,
            fecha_vencimiento: detail.fecha_vencimiento ?? null,
          });
          lotId = lot.id_lote_producto;
        }

        await client.query(
          `
          INSERT INTO compras.detalles_recepcion_compra (
            id_recepcion_compra, id_detalle_orden_compra, id_producto, id_ubicacion,
            id_lote_producto, cantidad_recibida, cantidad_aceptada, cantidad_rechazada,
            costo_unitario, porcentaje_impuesto, fecha_vencimiento, observaciones
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `,
          [
            header.rows[0].id_recepcion_compra,
            detail.id_detalle_orden_compra ?? null,
            detail.id_producto,
            detail.id_ubicacion ?? null,
            lotId,
            detail.cantidad_recibida,
            detail.cantidad_aceptada ?? detail.cantidad_recibida,
            detail.cantidad_rechazada ?? 0,
            detail.costo_unitario,
            detail.porcentaje_impuesto ?? 0,
            detail.fecha_vencimiento ?? null,
            detail.observaciones ?? null,
          ],
        );
      }

      return header.rows[0];
    });
  }

  async validateReception(receptionId: string, actor?: AuthUser) {
    const result = await this.db.query(
      `
      UPDATE compras.recepciones_compra
      SET estado = 'VALIDADA',
          validado_por = $2,
          fecha_validacion = now(),
          fecha_actualizacion = now()
      WHERE id_recepcion_compra = $1
      RETURNING *
      `,
      [receptionId, actor?.id_usuario ?? null],
    );
    return result.rows[0];
  }

  async applyReception(receptionId: string, actor?: AuthUser) {
    return this.db.withTransaction(async (client) => {
      const receptionResult = await client.query(
        `
        SELECT *
        FROM compras.recepciones_compra
        WHERE id_recepcion_compra = $1
        FOR UPDATE
        `,
        [receptionId],
      );
      const reception = receptionResult.rows[0];
      if (!reception) {
        throw new BadRequestException("Recepción no encontrada");
      }
      if (!["VALIDADA", "PENDIENTE_VALIDACION"].includes(reception.estado)) {
        throw new BadRequestException("La recepción no puede aplicarse");
      }

      const details = await client.query(
        `
        SELECT *
        FROM compras.detalles_recepcion_compra
        WHERE id_recepcion_compra = $1
        ORDER BY fecha_creacion
        `,
        [receptionId],
      );

      const documentId = await this.inventoryService.createMovementDocument(client, {
        tipoDocumento: "RECEPCION_COMPRA",
        prefijo: reception.prefijo ?? "RC",
        numeroDocumento: reception.numero_recepcion,
        estado: "APROBADO",
        idBodegaDestino: reception.id_bodega,
        responsableId: actor?.id_usuario ?? null,
        idTercero: reception.id_proveedor,
        motivo: "Recepción de compra",
        observaciones: reception.observaciones,
      });

      for (const [index, detail] of details.rows.entries()) {
        const acceptedQty = Number(detail.cantidad_aceptada || detail.cantidad_recibida);
        await this.inventoryService.increaseInventory(client, {
          movementCode: "RECEPCION_COMPRA",
          documentId,
          orderLine: index + 1,
          line: {
            id_producto: detail.id_producto,
            id_bodega: reception.id_bodega,
            id_ubicacion: detail.id_ubicacion,
            id_lote_producto: detail.id_lote_producto,
            cantidad: acceptedQty,
            costo_unitario: Number(detail.costo_unitario),
            detalle: "Recepción compra",
          },
        });

        if (detail.id_detalle_orden_compra) {
          await client.query(
            `
            UPDATE compras.detalles_orden_compra
            SET cantidad_recibida = cantidad_recibida + $2
            WHERE id_detalle_orden_compra = $1
            `,
            [detail.id_detalle_orden_compra, acceptedQty],
          );
        }
      }

      if (reception.id_orden_compra) {
        const pending = await client.query<{ pendiente: number }>(
          `
          SELECT count(*)::int AS pendiente
          FROM compras.detalles_orden_compra
          WHERE id_orden_compra = $1
            AND cantidad_recibida < cantidad
          `,
          [reception.id_orden_compra],
        );

        await client.query(
          `
          UPDATE compras.ordenes_compra
          SET estado = $2,
              fecha_actualizacion = now()
          WHERE id_orden_compra = $1
          `,
          [
            reception.id_orden_compra,
            pending.rows[0].pendiente > 0 ? "PARCIALMENTE_RECIBIDA" : "RECIBIDA",
          ],
        );
      }

      const result = await client.query(
        `
        UPDATE compras.recepciones_compra
        SET estado = 'APLICADA',
            fecha_actualizacion = now()
        WHERE id_recepcion_compra = $1
        RETURNING *
        `,
        [receptionId],
      );
      return result.rows[0];
    });
  }

  async createSupplierReturn(
    input: {
      codigo?: string;
      id_proveedor: string;
      id_bodega: string;
      id_recepcion_compra?: string | null;
      motivo: string;
      observaciones?: string;
      detalles: Array<{
        id_producto: string;
        id_lote_producto?: string | null;
        cantidad: number;
        costo_unitario?: number;
        motivo_detalle?: string;
        observaciones?: string;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const header = await client.query(
        `
        INSERT INTO compras.devoluciones_proveedor (
          codigo, id_proveedor, id_bodega, id_recepcion_compra, estado,
          motivo, observaciones, creado_por
        )
        VALUES ($1, $2, $3, $4, 'BORRADOR', $5, $6, $7)
        RETURNING *
        `,
        [
          input.codigo ?? this.generateNumber("DVP"),
          input.id_proveedor,
          input.id_bodega,
          input.id_recepcion_compra ?? null,
          input.motivo,
          input.observaciones ?? null,
          actor?.id_usuario ?? null,
        ],
      );

      for (const detail of input.detalles) {
        await client.query(
          `
          INSERT INTO compras.detalles_devolucion_proveedor (
            id_devolucion_proveedor, id_producto, id_lote_producto, cantidad,
            costo_unitario, motivo_detalle, observaciones
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            header.rows[0].id_devolucion_proveedor,
            detail.id_producto,
            detail.id_lote_producto ?? null,
            detail.cantidad,
            detail.costo_unitario ?? 0,
            detail.motivo_detalle ?? null,
            detail.observaciones ?? null,
          ],
        );
      }

      return header.rows[0];
    });
  }

  async approveSupplierReturn(returnId: string, actor?: AuthUser) {
    const result = await this.db.query(
      `
      UPDATE compras.devoluciones_proveedor
      SET estado = 'APROBADA',
          aprobado_por = $2,
          fecha_aprobacion = now(),
          fecha_actualizacion = now()
      WHERE id_devolucion_proveedor = $1
      RETURNING *
      `,
      [returnId, actor?.id_usuario ?? null],
    );
    return result.rows[0];
  }

  async dispatchSupplierReturn(returnId: string, actor?: AuthUser) {
    return this.db.withTransaction(async (client) => {
      const returnResult = await client.query(
        `
        SELECT *
        FROM compras.devoluciones_proveedor
        WHERE id_devolucion_proveedor = $1
        FOR UPDATE
        `,
        [returnId],
      );
      const supplierReturn = returnResult.rows[0];
      if (!supplierReturn || supplierReturn.estado !== "APROBADA") {
        throw new BadRequestException("La devolución debe estar aprobada");
      }

      const details = await client.query(
        `
        SELECT *
        FROM compras.detalles_devolucion_proveedor
        WHERE id_devolucion_proveedor = $1
        ORDER BY fecha_creacion
        `,
        [returnId],
      );

      const documentId = await this.inventoryService.createMovementDocument(client, {
        tipoDocumento: "DEVOLUCION_PROVEEDOR",
        prefijo: "DVP",
        numeroDocumento: supplierReturn.codigo,
        estado: "APROBADO",
        idBodegaOrigen: supplierReturn.id_bodega,
        responsableId: actor?.id_usuario ?? null,
        idTercero: supplierReturn.id_proveedor,
        motivo: supplierReturn.motivo,
        observaciones: supplierReturn.observaciones,
      });

      for (const [index, detail] of details.rows.entries()) {
        await this.inventoryService.decreaseInventory(client, {
          movementCode: "DEVOLUCION_PROVEEDOR",
          documentId,
          orderLine: index + 1,
          line: {
            id_producto: detail.id_producto,
            id_bodega: supplierReturn.id_bodega,
            id_lote_producto: detail.id_lote_producto,
            cantidad: Number(detail.cantidad),
            costo_unitario: Number(detail.costo_unitario ?? 0),
            detalle: detail.motivo_detalle ?? "Devolución a proveedor",
          },
        });
      }

      const result = await client.query(
        `
        UPDATE compras.devoluciones_proveedor
        SET estado = 'DESPACHADA',
            fecha_actualizacion = now()
        WHERE id_devolucion_proveedor = $1
        RETURNING *
        `,
        [returnId],
      );
      return result.rows[0];
    });
  }

  private calculateTotals(
    details: Array<{
      cantidad: number;
      costo_unitario: number;
      porcentaje_descuento?: number;
      porcentaje_impuesto?: number;
    }>,
  ) {
    return details.reduce(
      (acc, line) => {
        const totals = this.calculateLineTotals(line);
        acc.subtotal += totals.subtotal;
        acc.total_descuento += totals.total_descuento;
        acc.total_impuestos += totals.total_impuestos;
        acc.total_general += totals.total;
        return acc;
      },
      { subtotal: 0, total_descuento: 0, total_impuestos: 0, total_general: 0 },
    );
  }

  private calculateLineTotals(line: {
    cantidad: number;
    costo_unitario: number;
    porcentaje_descuento?: number;
    porcentaje_impuesto?: number;
  }) {
    const subtotal = Number(line.cantidad) * Number(line.costo_unitario);
    const total_descuento = subtotal * (Number(line.porcentaje_descuento ?? 0) / 100);
    const base = subtotal - total_descuento;
    const total_impuestos = base * (Number(line.porcentaje_impuesto ?? 0) / 100);
    return {
      subtotal: Number(subtotal.toFixed(2)),
      total_descuento: Number(total_descuento.toFixed(2)),
      total_impuestos: Number(total_impuestos.toFixed(2)),
      total: Number((base + total_impuestos).toFixed(2)),
    };
  }

  private generateNumber(prefix: string) {
    return `${prefix}-${Date.now()}`;
  }
}

@ApiTags("Purchases")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("purchases.manage")
@Controller("purchases")
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get(":entity")
  @ApiOperation({ summary: "Listar entidades auxiliares de compras" })
  async listEntity(
    @Param("entity") entity: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.purchasesService.listEntity(entity, query);
  }

  @Get(":entity/:id")
  @ApiOperation({ summary: "Consultar entidad auxiliar de compras" })
  async getEntity(@Param("entity") entity: string, @Param("id") id: string) {
    return this.purchasesService.getEntity(entity, id);
  }

  @Post(":entity")
  @ApiOperation({ summary: "Crear entidad auxiliar de compras" })
  async createEntity(@Param("entity") entity: string, @Body() payload: FlexibleDto) {
    return this.purchasesService.createEntity(entity, payload);
  }

  @Patch(":entity/:id")
  @ApiOperation({ summary: "Actualizar entidad auxiliar de compras" })
  async updateEntity(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
  ) {
    return this.purchasesService.updateEntity(entity, id, payload);
  }

  @Post("orders")
  @ApiOperation({ summary: "Crear orden de compra" })
  async createOrder(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.purchasesService.createOrder(
      payload as unknown as {
        id_proveedor: string;
        id_bodega_destino: string;
        id_moneda: string;
        detalles: Array<{ id_producto: string; cantidad: number; costo_unitario: number }>;
      },
      user,
    );
  }

  @Post("orders/:id/approve")
  @ApiOperation({ summary: "Aprobar orden de compra" })
  async approveOrder(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.purchasesService.approveOrder(id, user);
  }

  @Post("orders/:id/cancel")
  @ApiOperation({ summary: "Cancelar orden de compra" })
  async cancelOrder(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.purchasesService.cancelOrder(id, user);
  }

  @Post("receptions")
  @ApiOperation({ summary: "Crear recepción de compra" })
  async createReception(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.purchasesService.createReception(
      payload as unknown as {
        id_proveedor: string;
        id_bodega: string;
        detalles: Array<{ id_producto: string; cantidad_recibida: number; costo_unitario: number }>;
      },
      user,
    );
  }

  @Post("receptions/:id/validate")
  @ApiOperation({ summary: "Validar recepción de compra" })
  async validateReception(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.purchasesService.validateReception(id, user);
  }

  @Post("receptions/:id/apply")
  @ApiOperation({ summary: "Aplicar recepción de compra" })
  async applyReception(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.purchasesService.applyReception(id, user);
  }

  @Post("supplier-returns")
  @ApiOperation({ summary: "Crear devolución a proveedor" })
  async createSupplierReturn(
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.purchasesService.createSupplierReturn(
      payload as unknown as {
        id_proveedor: string;
        id_bodega: string;
        motivo: string;
        detalles: Array<{ id_producto: string; cantidad: number }>;
      },
      user,
    );
  }

  @Post("supplier-returns/:id/approve")
  @ApiOperation({ summary: "Aprobar devolución a proveedor" })
  async approveSupplierReturn(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.purchasesService.approveSupplierReturn(id, user);
  }

  @Post("supplier-returns/:id/dispatch")
  @ApiOperation({ summary: "Despachar devolución a proveedor" })
  async dispatchSupplierReturn(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.purchasesService.dispatchSupplierReturn(id, user);
  }
}

@Module({
  imports: [DatabaseModule, AuditModule, InventoryModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
