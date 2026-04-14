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
import {
  Permissions,
  PermissionsGuard,
} from "../../common/guards/permissions.guard";
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

const SALES_ENTITY_CONFIGS: Record<string, EntityConfig> = {
  clients: {
    route: "clients",
    table: "ventas.clientes",
    idColumn: "id_cliente",
    defaultOrderBy: "fecha_creacion",
    allowedColumns: [
      "id_tercero",
      "fecha_nacimiento",
      "acepta_marketing",
      "validado_mayor_edad",
      "fecha_validacion_edad",
      "canal_registro",
      "puntaje_riesgo",
      "activo",
    ],
    filterColumns: ["id_tercero", "activo", "validado_mayor_edad"],
    searchableColumns: ["canal_registro"],
  },
  "client-addresses": {
    route: "client-addresses",
    table: "ventas.direcciones_cliente",
    idColumn: "id_direccion_cliente",
    defaultOrderBy: "fecha_creacion",
    allowedColumns: [
      "id_cliente",
      "id_pais",
      "id_departamento",
      "id_ciudad",
      "direccion_linea_1",
      "direccion_linea_2",
      "codigo_postal",
      "es_principal",
      "tipo_direccion",
      "activa",
    ],
    filterColumns: ["id_cliente", "es_principal", "activa", "tipo_direccion"],
    searchableColumns: ["direccion_linea_1", "direccion_linea_2", "codigo_postal"],
  },
  "payment-methods": {
    route: "payment-methods",
    table: "ventas.metodos_pago",
    idColumn: "id_metodo_pago",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "tipo_metodo", "activo"],
    filterColumns: ["activo", "tipo_metodo"],
    searchableColumns: ["codigo", "nombre"],
  },
  "cash-registers": {
    route: "cash-registers",
    table: "ventas.cajas_punto_venta",
    idColumn: "id_caja_punto_venta",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "id_bodega", "id_canal_venta", "activa"],
    filterColumns: ["id_bodega", "id_canal_venta", "activa"],
    searchableColumns: ["codigo", "nombre"],
  },
  invoices: {
    route: "invoices",
    table: "ventas.facturas_venta",
    idColumn: "id_factura_venta",
    defaultOrderBy: "fecha_emision",
    allowedColumns: [
      "id_venta",
      "tipo_documento",
      "prefijo",
      "numero_documento",
      "cufe_cuds",
      "fecha_emision",
      "subtotal",
      "total_descuento",
      "total_impuestos",
      "total_general",
      "estado_dian",
      "xml_dian_url",
      "pdf_url",
      "hash_documento",
      "observaciones",
    ],
    filterColumns: ["id_venta", "tipo_documento", "estado_dian"],
    searchableColumns: ["numero_documento", "prefijo", "cufe_cuds"],
  },
};

class FlexibleDto {
  [key: string]: unknown;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
    private readonly inventoryService: InventoryService,
  ) {}

  async listEntity(entity: string, query: Record<string, unknown>) {
    const config = SALES_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de ventas no soportada: ${entity}`);
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
    const config = SALES_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de ventas no soportada: ${entity}`);
    }
    const result = await this.db.query(
      `SELECT * FROM ${config.table} WHERE ${config.idColumn} = $1`,
      [id],
    );
    return result.rows[0];
  }

  async createEntity(entity: string, payload: Record<string, unknown>) {
    const config = SALES_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de ventas no soportada: ${entity}`);
    }
    const data = pickAllowedValues(payload, config.allowedColumns);
    const query = buildInsertQuery(config.table, data, config.idColumn);
    const result = await this.db.query(query.text, query.values);
    return result.rows[0];
  }

  async updateEntity(entity: string, id: string, payload: Record<string, unknown>) {
    const config = SALES_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(`Entidad de ventas no soportada: ${entity}`);
    }
    const data = pickAllowedValues(payload, config.allowedColumns);
    const query = buildUpdateQuery(config.table, data, config.idColumn, id);
    const result = await this.db.query(query.text, query.values);
    return result.rows[0];
  }

  async createSale(
    input: {
      prefijo?: string;
      numero_venta?: string;
      tipo_venta: string;
      id_cliente?: string | null;
      id_bodega: string;
      id_caja_punto_venta?: string | null;
      id_canal_venta?: string | null;
      observaciones?: string;
      detalles: Array<{
        id_producto: string;
        id_lote_producto?: string | null;
        id_producto_embalaje?: string | null;
        cantidad: number;
        precio_unitario: number;
        porcentaje_descuento?: number;
        porcentaje_impuesto?: number;
        observaciones?: string;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const productIds = input.detalles.map((detail) => detail.id_producto);
      const products = await client.query<{
        id_producto: string;
        es_restringido: boolean;
        requiere_control_mayoria_edad: boolean;
      }>(
        `
        SELECT id_producto, es_restringido, requiere_control_mayoria_edad
        FROM maestros.productos
        WHERE id_producto = ANY($1::uuid[])
        `,
        [productIds],
      );

      const restrictions = new Map(
        products.rows.map((row: {
          id_producto: string;
          es_restringido: boolean;
          requiere_control_mayoria_edad: boolean;
        }) => [
          row.id_producto,
          row.es_restringido || row.requiere_control_mayoria_edad,
        ]),
      );

      const totals = this.calculateTotals(input.detalles);
      const requiresAge = input.detalles.some((detail) =>
        restrictions.get(detail.id_producto),
      );

      const header = await client.query(
        `
        INSERT INTO ventas.ventas (
          prefijo, numero_venta, tipo_venta, id_cliente, id_bodega,
          id_caja_punto_venta, id_canal_venta, estado, subtotal, total_descuento,
          total_impuestos, total_general, observaciones,
          control_mayoria_edad_requerido, creado_por
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'BORRADOR', $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
        `,
        [
          input.prefijo ?? "VT",
          input.numero_venta ?? this.generateNumber("VT"),
          input.tipo_venta,
          input.id_cliente ?? null,
          input.id_bodega,
          input.id_caja_punto_venta ?? null,
          input.id_canal_venta ?? null,
          totals.subtotal,
          totals.total_descuento,
          totals.total_impuestos,
          totals.total_general,
          input.observaciones ?? null,
          requiresAge,
          actor?.id_usuario ?? null,
        ],
      );

      for (const detail of input.detalles) {
        const lineTotals = this.calculateLineTotals(detail);
        await client.query(
          `
          INSERT INTO ventas.detalles_venta (
            id_venta, id_producto, id_lote_producto, id_producto_embalaje,
            cantidad, precio_unitario, porcentaje_descuento, porcentaje_impuesto,
            subtotal, total, requiere_control_mayoria_edad, observaciones
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `,
          [
            header.rows[0].id_venta,
            detail.id_producto,
            detail.id_lote_producto ?? null,
            detail.id_producto_embalaje ?? null,
            detail.cantidad,
            detail.precio_unitario,
            detail.porcentaje_descuento ?? 0,
            detail.porcentaje_impuesto ?? 0,
            lineTotals.subtotal,
            lineTotals.total,
            restrictions.get(detail.id_producto) ?? false,
            detail.observaciones ?? null,
          ],
        );
      }

      return header.rows[0];
    });
  }

  async confirmSale(
    saleId: string,
    input: { control_mayoria_edad_realizado?: boolean },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const saleResult = await client.query(
        "SELECT * FROM ventas.ventas WHERE id_venta = $1 FOR UPDATE",
        [saleId],
      );
      const sale = saleResult.rows[0];
      if (!sale) {
        throw new BadRequestException("Venta no encontrada");
      }
      if (sale.estado !== "BORRADOR") {
        throw new BadRequestException("La venta ya fue procesada");
      }
      if (
        sale.control_mayoria_edad_requerido &&
        !input.control_mayoria_edad_realizado
      ) {
        throw new BadRequestException(
          "La venta requiere control de mayoría de edad",
        );
      }

      const details = await client.query(
        `
        SELECT *
        FROM ventas.detalles_venta
        WHERE id_venta = $1
        ORDER BY fecha_creacion
        `,
        [saleId],
      );

      const documentId = await this.inventoryService.createMovementDocument(client, {
        tipoDocumento: "VENTA",
        prefijo: sale.prefijo ?? "VT",
        numeroDocumento: sale.numero_venta,
        estado: "APROBADO",
        idBodegaOrigen: sale.id_bodega,
        responsableId: actor?.id_usuario ?? null,
        motivo: "Salida por venta",
        observaciones: sale.observaciones,
      });

      for (const [index, detail] of details.rows.entries()) {
        await this.inventoryService.decreaseInventory(client, {
          movementCode: "VENTA",
          documentId,
          orderLine: index + 1,
          line: {
            id_producto: detail.id_producto,
            id_bodega: sale.id_bodega,
            id_lote_producto: detail.id_lote_producto,
            cantidad: Number(detail.cantidad),
            costo_unitario: Number(detail.precio_unitario),
            detalle: "Salida por venta",
          },
        });
      }

      const result = await client.query(
        `
        UPDATE ventas.ventas
        SET estado = 'CONFIRMADA',
            control_mayoria_edad_realizado = $2,
            fecha_control_mayoria_edad = CASE WHEN $2 THEN now() ELSE fecha_control_mayoria_edad END,
            fecha_actualizacion = now()
        WHERE id_venta = $1
        RETURNING *
        `,
        [saleId, input.control_mayoria_edad_realizado ?? false],
      );
      return result.rows[0];
    });
  }

  async addPayment(
    saleId: string,
    input: {
      id_metodo_pago: string;
      valor_pagado: number;
      referencia_pago?: string;
      observaciones?: string;
    },
  ) {
    const result = await this.db.query(
      `
      INSERT INTO ventas.pagos_venta (
        id_venta, id_metodo_pago, valor_pagado, referencia_pago, observaciones
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        saleId,
        input.id_metodo_pago,
        input.valor_pagado,
        input.referencia_pago ?? null,
        input.observaciones ?? null,
      ],
    );
    return result.rows[0];
  }

  async invoiceSale(
    saleId: string,
    input: {
      tipo_documento: string;
      prefijo?: string;
      numero_documento?: string;
      estado_dian?: string;
      xml_dian_url?: string;
      pdf_url?: string;
    },
  ) {
    return this.db.withTransaction(async (client) => {
      const saleResult = await client.query(
        "SELECT * FROM ventas.ventas WHERE id_venta = $1 FOR UPDATE",
        [saleId],
      );
      const sale = saleResult.rows[0];
      if (!sale || !["CONFIRMADA", "FACTURADA"].includes(sale.estado)) {
        throw new BadRequestException("La venta debe estar confirmada");
      }

      const result = await client.query(
        `
        INSERT INTO ventas.facturas_venta (
          id_venta, tipo_documento, prefijo, numero_documento, fecha_emision,
          subtotal, total_descuento, total_impuestos, total_general,
          estado_dian, xml_dian_url, pdf_url
        )
        VALUES ($1, $2, $3, $4, now(), $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id_venta) DO UPDATE
          SET tipo_documento = EXCLUDED.tipo_documento,
              prefijo = EXCLUDED.prefijo,
              numero_documento = EXCLUDED.numero_documento,
              estado_dian = EXCLUDED.estado_dian,
              xml_dian_url = EXCLUDED.xml_dian_url,
              pdf_url = EXCLUDED.pdf_url,
              fecha_actualizacion = now()
        RETURNING *
        `,
        [
          saleId,
          input.tipo_documento,
          input.prefijo ?? "FV",
          input.numero_documento ?? this.generateNumber("FV"),
          sale.subtotal,
          sale.total_descuento,
          sale.total_impuestos,
          sale.total_general,
          input.estado_dian ?? "PENDIENTE",
          input.xml_dian_url ?? null,
          input.pdf_url ?? null,
        ],
      );

      await client.query(
        `
        UPDATE ventas.ventas
        SET estado = 'FACTURADA',
            fecha_actualizacion = now()
        WHERE id_venta = $1
        `,
        [saleId],
      );
      return result.rows[0];
    });
  }

  async cancelSale(saleId: string, actor?: AuthUser) {
    return this.db.withTransaction(async (client) => {
      const saleResult = await client.query(
        "SELECT * FROM ventas.ventas WHERE id_venta = $1 FOR UPDATE",
        [saleId],
      );
      const sale = saleResult.rows[0];
      if (!sale) {
        throw new BadRequestException("Venta no encontrada");
      }
      if (sale.estado === "ANULADA") {
        return sale;
      }

      if (sale.estado !== "BORRADOR") {
        const details = await client.query(
          "SELECT * FROM ventas.detalles_venta WHERE id_venta = $1 ORDER BY fecha_creacion",
          [saleId],
        );
        const documentId = await this.inventoryService.createMovementDocument(client, {
          tipoDocumento: "ANULACION_VENTA",
          prefijo: sale.prefijo ?? "VT",
          numeroDocumento: `${sale.numero_venta}-AN`,
          estado: "APROBADO",
          idBodegaDestino: sale.id_bodega,
          responsableId: actor?.id_usuario ?? null,
          motivo: "Reverso por anulación de venta",
        });

        for (const [index, detail] of details.rows.entries()) {
          await this.inventoryService.increaseInventory(client, {
            movementCode: "DEVOLUCION_CLIENTE",
            documentId,
            orderLine: index + 1,
            line: {
              id_producto: detail.id_producto,
              id_bodega: sale.id_bodega,
              id_lote_producto: detail.id_lote_producto,
              cantidad: Number(detail.cantidad),
              costo_unitario: Number(detail.precio_unitario),
              detalle: "Reverso por anulación",
            },
          });
        }
      }

      const result = await client.query(
        `
        UPDATE ventas.ventas
        SET estado = 'ANULADA',
            fecha_actualizacion = now()
        WHERE id_venta = $1
        RETURNING *
        `,
        [saleId],
      );
      return result.rows[0];
    });
  }

  async createEcommerceOrder(
    input: {
      codigo_pedido?: string;
      id_cliente?: string | null;
      id_canal_venta?: string | null;
      id_bodega_despacho?: string | null;
      costo_envio?: number;
      observaciones?: string;
      referencia_externa?: string;
      detalles: Array<{
        id_producto: string;
        cantidad: number;
        precio_unitario: number;
        porcentaje_descuento?: number;
        porcentaje_impuesto?: number;
      }>;
    },
  ) {
    return this.db.withTransaction(async (client) => {
      const productIds = input.detalles.map((detail) => detail.id_producto);
      const products = await client.query<{
        id_producto: string;
        es_restringido: boolean;
        requiere_control_mayoria_edad: boolean;
      }>(
        `
        SELECT id_producto, es_restringido, requiere_control_mayoria_edad
        FROM maestros.productos
        WHERE id_producto = ANY($1::uuid[])
        `,
        [productIds],
      );
      const restrictions = new Set(
        products.rows
          .filter(
            (row: {
              id_producto: string;
              es_restringido: boolean;
              requiere_control_mayoria_edad: boolean;
            }) => row.es_restringido || row.requiere_control_mayoria_edad,
          )
          .map((row: { id_producto: string }) => row.id_producto),
      );
      const totals = this.calculateTotals(input.detalles);
      const header = await client.query(
        `
        INSERT INTO ventas.pedidos_ecommerce (
          codigo_pedido, id_cliente, id_canal_venta, id_bodega_despacho, estado,
          subtotal, total_descuento, total_impuestos, costo_envio, total_general,
          observaciones, referencia_externa, control_mayoria_edad_requerido
        )
        VALUES ($1, $2, $3, $4, 'RECIBIDO', $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
        `,
        [
          input.codigo_pedido ?? this.generateNumber("PED"),
          input.id_cliente ?? null,
          input.id_canal_venta ?? null,
          input.id_bodega_despacho ?? null,
          totals.subtotal,
          totals.total_descuento,
          totals.total_impuestos,
          input.costo_envio ?? 0,
          totals.total_general + Number(input.costo_envio ?? 0),
          input.observaciones ?? null,
          input.referencia_externa ?? null,
          input.detalles.some((detail) => restrictions.has(detail.id_producto)),
        ],
      );

      for (const detail of input.detalles) {
        const lineTotals = this.calculateLineTotals(detail);
        await client.query(
          `
          INSERT INTO ventas.detalles_pedido_ecommerce (
            id_pedido_ecommerce, id_producto, cantidad, precio_unitario,
            porcentaje_descuento, porcentaje_impuesto, subtotal, total,
            requiere_control_mayoria_edad
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            header.rows[0].id_pedido_ecommerce,
            detail.id_producto,
            detail.cantidad,
            detail.precio_unitario,
            detail.porcentaje_descuento ?? 0,
            detail.porcentaje_impuesto ?? 0,
            lineTotals.subtotal,
            lineTotals.total,
            restrictions.has(detail.id_producto),
          ],
        );
      }

      return header.rows[0];
    });
  }

  async reserveEcommerceOrder(
    orderId: string,
    input: { control_mayoria_edad_realizado?: boolean },
    actor?: AuthUser,
  ) {
    const orderResult = await this.db.query<{
      id_bodega_despacho: string;
      control_mayoria_edad_requerido: boolean;
    }>(
      "SELECT * FROM ventas.pedidos_ecommerce WHERE id_pedido_ecommerce = $1",
      [orderId],
    );
    const order = orderResult.rows[0];
    if (!order) {
      throw new BadRequestException("Pedido no encontrado");
    }
    if (order.control_mayoria_edad_requerido && !input.control_mayoria_edad_realizado) {
      throw new BadRequestException("El pedido requiere validación de mayoría de edad");
    }

    const details = await this.db.query<{ id_producto: string; cantidad: number }>(
      "SELECT * FROM ventas.detalles_pedido_ecommerce WHERE id_pedido_ecommerce = $1",
      [orderId],
    );

    for (const detail of details.rows) {
      await this.inventoryService.reserveInventory(
        {
          id_producto: detail.id_producto,
          id_bodega: order.id_bodega_despacho,
          tipo_origen: "PEDIDO_ECOMMERCE",
          id_documento_origen: orderId,
          cantidad: Number(detail.cantidad),
        },
        actor,
      );
    }

    const result = await this.db.query(
      `
      UPDATE ventas.pedidos_ecommerce
      SET estado = 'RESERVADO',
          control_mayoria_edad_realizado = $2,
          fecha_actualizacion = now()
      WHERE id_pedido_ecommerce = $1
      RETURNING *
      `,
      [orderId, input.control_mayoria_edad_realizado ?? false],
    );
    return result.rows[0];
  }

  async dispatchEcommerceOrder(orderId: string, actor?: AuthUser) {
    const reservations = await this.db.query<{ id_reserva_inventario: string }>(
      `
      SELECT *
      FROM inventario.reservas_inventario
      WHERE id_documento_origen = $1
        AND estado = 'ACTIVA'
      ORDER BY fecha_reserva
      `,
      [orderId],
    );

    for (const reservation of reservations.rows) {
      await this.inventoryService.consumeReservation(
        reservation.id_reserva_inventario,
        { tipo_documento: "DESPACHO_ECOMMERCE", motivo: "Despacho ecommerce" },
        actor,
      );
    }

    const result = await this.db.query(
      `
      UPDATE ventas.pedidos_ecommerce
      SET estado = 'DESPACHADO',
          fecha_actualizacion = now()
      WHERE id_pedido_ecommerce = $1
      RETURNING *
      `,
      [orderId],
    );
    return result.rows[0];
  }

  async deliverEcommerceOrder(orderId: string) {
    const result = await this.db.query(
      `
      UPDATE ventas.pedidos_ecommerce
      SET estado = 'ENTREGADO',
          fecha_actualizacion = now()
      WHERE id_pedido_ecommerce = $1
      RETURNING *
      `,
      [orderId],
    );
    return result.rows[0];
  }

  async createCustomerReturn(
    input: {
      codigo?: string;
      id_venta?: string | null;
      id_pedido_ecommerce?: string | null;
      id_cliente?: string | null;
      id_bodega_recepcion?: string | null;
      tipo_devolucion: string;
      motivo: string;
      descripcion_caso?: string;
      evidencia_url?: string;
      detalles: Array<{
        id_producto: string;
        id_lote_producto?: string | null;
        cantidad: number;
        estado_producto_recibido: string;
        decision_final?: string;
        observaciones?: string;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const header = await client.query(
        `
        INSERT INTO ventas.devoluciones_cliente (
          codigo, id_venta, id_pedido_ecommerce, id_cliente, id_bodega_recepcion,
          tipo_devolucion, estado, motivo, descripcion_caso, evidencia_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'RADICADA', $7, $8, $9)
        RETURNING *
        `,
        [
          input.codigo ?? this.generateNumber("DVC"),
          input.id_venta ?? null,
          input.id_pedido_ecommerce ?? null,
          input.id_cliente ?? null,
          input.id_bodega_recepcion ?? null,
          input.tipo_devolucion,
          input.motivo,
          input.descripcion_caso ?? null,
          input.evidencia_url ?? null,
        ],
      );

      for (const detail of input.detalles) {
        await client.query(
          `
          INSERT INTO ventas.detalles_devolucion_cliente (
            id_devolucion_cliente, id_producto, id_lote_producto, cantidad,
            estado_producto_recibido, decision_final, observaciones
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            header.rows[0].id_devolucion_cliente,
            detail.id_producto,
            detail.id_lote_producto ?? null,
            detail.cantidad,
            detail.estado_producto_recibido,
            detail.decision_final ?? null,
            detail.observaciones ?? null,
          ],
        );
      }

      return header.rows[0];
    });
  }

  async resolveCustomerReturn(
    returnId: string,
    input: { approved: boolean },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const returnResult = await client.query(
        "SELECT * FROM ventas.devoluciones_cliente WHERE id_devolucion_cliente = $1 FOR UPDATE",
        [returnId],
      );
      const customerReturn = returnResult.rows[0];
      if (!customerReturn) {
        throw new BadRequestException("Devolución no encontrada");
      }

      await client.query(
        `
        UPDATE ventas.devoluciones_cliente
        SET estado = $2,
            fecha_resolucion = now(),
            resuelto_por = $3,
            fecha_actualizacion = now()
        WHERE id_devolucion_cliente = $1
        `,
        [returnId, input.approved ? "APROBADA" : "RECHAZADA", actor?.id_usuario ?? null],
      );

      if (input.approved && customerReturn.id_bodega_recepcion) {
        const details = await client.query(
          `
          SELECT *
          FROM ventas.detalles_devolucion_cliente
          WHERE id_devolucion_cliente = $1
          `,
          [returnId],
        );

        const documentId = await this.inventoryService.createMovementDocument(client, {
          tipoDocumento: "DEVOLUCION_CLIENTE",
          prefijo: "DVC",
          numeroDocumento: customerReturn.codigo,
          estado: "APROBADO",
          idBodegaDestino: customerReturn.id_bodega_recepcion,
          responsableId: actor?.id_usuario ?? null,
          motivo: customerReturn.motivo,
          observaciones: customerReturn.descripcion_caso,
        });

        for (const [index, detail] of details.rows.entries()) {
          if (detail.decision_final === "REINTEGRA_STOCK") {
            await this.inventoryService.increaseInventory(client, {
              movementCode: "DEVOLUCION_CLIENTE",
              documentId,
              orderLine: index + 1,
              line: {
                id_producto: detail.id_producto,
                id_bodega: customerReturn.id_bodega_recepcion,
                id_lote_producto: detail.id_lote_producto,
                cantidad: Number(detail.cantidad),
                costo_unitario: 0,
                detalle: "Devolución cliente reintegrada",
              },
            });
          }
          if (detail.decision_final === "CUARENTENA") {
            await this.inventoryService.blockInventory(
              {
                id_producto: detail.id_producto,
                id_bodega: customerReturn.id_bodega_recepcion,
                id_lote_producto: detail.id_lote_producto,
                tipo_bloqueo: "CUARENTENA",
                cantidad_bloqueada: Number(detail.cantidad),
                motivo: "Producto recibido en devolución y enviado a cuarentena",
              },
              actor,
            );
          }
        }
      }

      const result = await client.query(
        `
        UPDATE ventas.devoluciones_cliente
        SET estado = CASE WHEN $2 THEN 'CERRADA' ELSE 'RECHAZADA' END,
            fecha_actualizacion = now()
        WHERE id_devolucion_cliente = $1
        RETURNING *
        `,
        [returnId, input.approved],
      );
      return result.rows[0];
    });
  }

  private calculateTotals(
    details: Array<{
      cantidad: number;
      precio_unitario: number;
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
    precio_unitario: number;
    porcentaje_descuento?: number;
    porcentaje_impuesto?: number;
  }) {
    const subtotal = Number(line.cantidad) * Number(line.precio_unitario);
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

@ApiTags("Sales")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("sales.manage")
@Controller("sales")
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get(":entity")
  @ApiOperation({ summary: "Listar entidades auxiliares de ventas" })
  async listEntity(@Param("entity") entity: string, @Query() query: Record<string, unknown>) {
    return this.salesService.listEntity(entity, query);
  }

  @Get(":entity/:id")
  @ApiOperation({ summary: "Consultar entidad auxiliar de ventas" })
  async getEntity(@Param("entity") entity: string, @Param("id") id: string) {
    return this.salesService.getEntity(entity, id);
  }

  @Post(":entity")
  @ApiOperation({ summary: "Crear entidad auxiliar de ventas" })
  async createEntity(@Param("entity") entity: string, @Body() payload: FlexibleDto) {
    return this.salesService.createEntity(entity, payload);
  }

  @Patch(":entity/:id")
  @ApiOperation({ summary: "Actualizar entidad auxiliar de ventas" })
  async updateEntity(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
  ) {
    return this.salesService.updateEntity(entity, id, payload);
  }

  @Post("orders")
  @ApiOperation({ summary: "Crear venta" })
  async createSale(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.salesService.createSale(
      payload as unknown as {
        tipo_venta: string;
        id_bodega: string;
        detalles: Array<{ id_producto: string; cantidad: number; precio_unitario: number }>;
      },
      user,
    );
  }

  @Post("orders/:id/confirm")
  @ApiOperation({ summary: "Confirmar venta y descargar inventario" })
  async confirmSale(
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.confirmSale(
      id,
      payload as unknown as { control_mayoria_edad_realizado?: boolean },
      user,
    );
  }

  @Post("orders/:id/payments")
  @ApiOperation({ summary: "Registrar pago de venta" })
  async addPayment(@Param("id") id: string, @Body() payload: FlexibleDto) {
    return this.salesService.addPayment(
      id,
      payload as unknown as { id_metodo_pago: string; valor_pagado: number },
    );
  }

  @Post("orders/:id/invoice")
  @ApiOperation({ summary: "Emitir factura de venta" })
  async invoiceSale(@Param("id") id: string, @Body() payload: FlexibleDto) {
    return this.salesService.invoiceSale(
      id,
      payload as unknown as { tipo_documento: string },
    );
  }

  @Post("orders/:id/cancel")
  @ApiOperation({ summary: "Anular venta" })
  async cancelSale(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.cancelSale(id, user);
  }

  @Post("ecommerce-orders")
  @ApiOperation({ summary: "Crear pedido ecommerce" })
  async createEcommerceOrder(@Body() payload: FlexibleDto) {
    return this.salesService.createEcommerceOrder(
      payload as unknown as {
        detalles: Array<{ id_producto: string; cantidad: number; precio_unitario: number }>;
      },
    );
  }

  @Post("ecommerce-orders/:id/reserve")
  @ApiOperation({ summary: "Reservar inventario para pedido ecommerce" })
  async reserveEcommerceOrder(
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.reserveEcommerceOrder(
      id,
      payload as unknown as { control_mayoria_edad_realizado?: boolean },
      user,
    );
  }

  @Post("ecommerce-orders/:id/dispatch")
  @ApiOperation({ summary: "Despachar pedido ecommerce" })
  async dispatchEcommerceOrder(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.dispatchEcommerceOrder(id, user);
  }

  @Post("ecommerce-orders/:id/deliver")
  @ApiOperation({ summary: "Marcar pedido ecommerce como entregado" })
  async deliverEcommerceOrder(@Param("id") id: string) {
    return this.salesService.deliverEcommerceOrder(id);
  }

  @Post("returns")
  @ApiOperation({ summary: "Radicar devolución de cliente" })
  async createCustomerReturn(
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.createCustomerReturn(
      payload as unknown as {
        tipo_devolucion: string;
        motivo: string;
        detalles: Array<{ id_producto: string; cantidad: number; estado_producto_recibido: string }>;
      },
      user,
    );
  }

  @Post("returns/:id/resolve")
  @ApiOperation({ summary: "Resolver devolución de cliente" })
  async resolveCustomerReturn(
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.resolveCustomerReturn(
      id,
      payload as unknown as { approved: boolean },
      user,
    );
  }
}

@Module({
  imports: [DatabaseModule, AuditModule, InventoryModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
