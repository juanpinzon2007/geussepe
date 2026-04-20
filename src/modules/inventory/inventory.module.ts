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
import type { PoolClient } from "pg";
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

const INVENTORY_ENTITY_CONFIGS: Record<string, EntityConfig> = {
  branches: {
    route: "branches",
    table: "inventario.sucursales",
    idColumn: "id_sucursal",
    defaultOrderBy: "nombre",
    allowedColumns: [
      "codigo",
      "nombre",
      "id_direccion_tercero",
      "telefono",
      "correo_electronico",
      "activa",
    ],
    filterColumns: ["activa", "codigo"],
    searchableColumns: ["codigo", "nombre", "telefono", "correo_electronico"],
  },
  warehouses: {
    route: "warehouses",
    table: "inventario.bodegas",
    idColumn: "id_bodega",
    defaultOrderBy: "nombre",
    allowedColumns: [
      "id_sucursal",
      "codigo",
      "nombre",
      "tipo_bodega",
      "id_pais",
      "id_departamento",
      "id_ciudad",
      "direccion",
      "responsable_id_usuario",
      "permite_ventas",
      "permite_compras",
      "permite_traslados",
      "requiere_aprobacion_ajustes",
      "activa",
      "observaciones",
    ],
    filterColumns: ["id_sucursal", "tipo_bodega", "activa", "permite_ventas"],
    searchableColumns: ["codigo", "nombre", "direccion"],
  },
  "warehouse-zones": {
    route: "warehouse-zones",
    table: "inventario.zonas_bodega",
    idColumn: "id_zona_bodega",
    defaultOrderBy: "nombre",
    allowedColumns: ["id_bodega", "codigo", "nombre", "tipo_zona", "activa"],
    filterColumns: ["id_bodega", "tipo_zona", "activa"],
    searchableColumns: ["codigo", "nombre"],
  },
  locations: {
    route: "locations",
    table: "inventario.ubicaciones",
    idColumn: "id_ubicacion",
    defaultOrderBy: "codigo",
    allowedColumns: [
      "id_bodega",
      "id_zona_bodega",
      "codigo",
      "pasillo",
      "estante",
      "nivel",
      "posicion",
      "capacidad_unidades",
      "capacidad_volumen",
      "capacidad_peso",
      "bloqueada",
      "activa",
    ],
    filterColumns: ["id_bodega", "id_zona_bodega", "bloqueada", "activa"],
    searchableColumns: ["codigo", "pasillo", "estante", "nivel", "posicion"],
  },
  lots: {
    route: "lots",
    table: "inventario.lotes_producto",
    idColumn: "id_lote_producto",
    defaultOrderBy: "fecha_vencimiento",
    allowedColumns: [
      "id_producto",
      "numero_lote",
      "fecha_fabricacion",
      "fecha_vencimiento",
      "id_registro_sanitario_producto",
      "estado_lote",
      "observaciones",
    ],
    filterColumns: ["id_producto", "estado_lote"],
    searchableColumns: ["numero_lote", "observaciones"],
  },
  "movement-types": {
    route: "movement-types",
    table: "inventario.tipos_movimiento_inventario",
    idColumn: "id_tipo_movimiento_inventario",
    defaultOrderBy: "codigo",
    allowedColumns: [
      "codigo",
      "nombre",
      "naturaleza",
      "afecta_costo",
      "requiere_aprobacion",
      "activo",
    ],
    filterColumns: ["naturaleza", "activo", "requiere_aprobacion"],
    searchableColumns: ["codigo", "nombre"],
  },
};

type InventoryLine = {
  id_producto: string;
  id_bodega: string;
  id_ubicacion?: string | null;
  id_lote_producto?: string | null;
  cantidad: number;
  costo_unitario?: number;
  detalle?: string;
};

type ExistenceKey = {
  idProducto: string;
  idBodega: string;
  idUbicacion?: string | null;
  idLoteProducto?: string | null;
};

class FlexibleDto {
  [key: string]: unknown;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  getCatalog() {
    return Object.keys(INVENTORY_ENTITY_CONFIGS);
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

  async createEntity(
    entity: string,
    payload: Record<string, unknown>,
    actor?: AuthUser,
  ) {
    const config = this.getConfig(entity);
    const data = pickAllowedValues(payload, config.allowedColumns);
    const query = buildInsertQuery(config.table, data, config.idColumn);
    const result = await this.db.query(query.text, query.values);

    await this.auditService.logEvent({
      modulo: "inventory",
      nombreTabla: config.table,
      idRegistro: result.rows[0][config.idColumn] as string,
      tipoEvento: "INSERT",
      descripcion: `Creación en ${config.route}`,
      idUsuario: actor?.id_usuario ?? null,
      valorNuevo: result.rows[0],
    });

    return result.rows[0];
  }

  async updateEntity(
    entity: string,
    id: string,
    payload: Record<string, unknown>,
    actor?: AuthUser,
  ) {
    const config = this.getConfig(entity);
    const before = await this.getEntity(entity, id);
    const data = pickAllowedValues(payload, config.allowedColumns);
    const query = buildUpdateQuery(config.table, data, config.idColumn, id);
    const result = await this.db.query(query.text, query.values);

    await this.auditService.logEvent({
      modulo: "inventory",
      nombreTabla: config.table,
      idRegistro: id,
      tipoEvento: "UPDATE",
      descripcion: `Actualización en ${config.route}`,
      idUsuario: actor?.id_usuario ?? null,
      valorAnterior: before,
      valorNuevo: result.rows[0],
    });

    return result.rows[0];
  }

  async listStock(query: Record<string, unknown>) {
    const values: unknown[] = [];
    const where: string[] = [];
    for (const column of [
      "id_producto",
      "id_bodega",
      "id_ubicacion",
      "id_lote_producto",
    ]) {
      const value = query[column];
      if (value) {
        values.push(value);
        where.push(`${column} = $${values.length}`);
      }
    }

    if (query.only_low_stock === "true") {
      where.push("cantidad_disponible <= stock_minimo");
    }

    const result = await this.db.query(
      `
      SELECT *
      FROM inventario.v_stock_actual
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY nombre_producto, nombre_bodega
      LIMIT 500
      `,
      values,
    );
    return result.rows;
  }

  async kardex(query: Record<string, unknown>) {
    const values: unknown[] = [];
    const where: string[] = [];

    for (const column of [
      "m.id_producto",
      "m.id_bodega",
      "d.id_documento_movimiento_inventario",
    ]) {
      const key = column.split(".")[1];
      const value = query[key];
      if (value) {
        values.push(value);
        where.push(`${column} = $${values.length}`);
      }
    }

    if (query.fecha_desde) {
      values.push(query.fecha_desde);
      where.push(`m.fecha_movimiento >= $${values.length}`);
    }

    if (query.fecha_hasta) {
      values.push(query.fecha_hasta);
      where.push(`m.fecha_movimiento <= $${values.length}`);
    }

    const result = await this.db.query(
      `
      SELECT m.*, d.tipo_documento, d.numero_documento, t.codigo AS codigo_tipo_movimiento,
             p.sku, p.nombre AS nombre_producto, b.nombre AS nombre_bodega
      FROM inventario.movimientos_inventario m
      JOIN inventario.documentos_movimiento_inventario d
        ON d.id_documento_movimiento_inventario = m.id_documento_movimiento_inventario
      JOIN inventario.tipos_movimiento_inventario t
        ON t.id_tipo_movimiento_inventario = m.id_tipo_movimiento_inventario
      JOIN maestros.productos p ON p.id_producto = m.id_producto
      JOIN inventario.bodegas b ON b.id_bodega = m.id_bodega
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY m.fecha_movimiento DESC, m.orden_linea
      LIMIT 500
      `,
      values,
    );
    return result.rows;
  }

  async createManualDocument(
    input: {
      tipo_documento: string;
      prefijo?: string;
      numero_documento?: string;
      motivo?: string;
      observaciones?: string;
      id_bodega?: string;
      id_bodega_destino?: string;
      id_tercero?: string;
      requires_approval?: boolean;
      apply_now?: boolean;
      movement_code: "ENTRADA_MANUAL" | "SALIDA_MANUAL";
      lines: InventoryLine[];
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const lineWarehouseId =
        input.movement_code === "ENTRADA_MANUAL"
          ? input.id_bodega ?? null
          : input.id_bodega_destino ?? input.id_bodega ?? null;

      if (!lineWarehouseId) {
        throw new BadRequestException(
          "El documento manual requiere una bodega asociada a las líneas",
        );
      }

      const documentId = await this.createDocument(client, {
        tipoDocumento: input.tipo_documento,
        prefijo: input.prefijo ?? "INV",
        numeroDocumento: input.numero_documento ?? this.generateNumber("INV"),
        estado: input.requires_approval ? "PENDIENTE" : "APROBADO",
        idBodegaOrigen:
          input.movement_code === "SALIDA_MANUAL" ? input.id_bodega ?? null : null,
        idBodegaDestino:
          input.movement_code === "ENTRADA_MANUAL"
            ? input.id_bodega ?? null
            : input.id_bodega_destino ?? null,
        idTercero: input.id_tercero ?? null,
        motivo: input.motivo ?? null,
        observaciones: input.observaciones ?? null,
        responsableId: actor?.id_usuario ?? null,
      });

      for (const [index, line] of input.lines.entries()) {
        await this.stageMovement(client, {
          documentId,
          movementCode: input.movement_code,
          line: {
            ...line,
            id_bodega: line.id_bodega ?? lineWarehouseId,
          },
          sign: input.movement_code === "ENTRADA_MANUAL" ? 1 : -1,
          orderLine: index + 1,
        });
      }

      if (input.apply_now || !input.requires_approval) {
        await this.applyDocumentWithClient(client, documentId, actor);
      }

      return this.getMovementDocumentById(client, documentId);
    });
  }

  async applyDocument(documentId: string, actor?: AuthUser) {
    return this.db.withTransaction((client) =>
      this.applyDocumentWithClient(client, documentId, actor),
    );
  }

  async reserveInventory(
    input: {
      id_producto: string;
      id_bodega: string;
      id_ubicacion?: string | null;
      id_lote_producto?: string | null;
      tipo_origen: string;
      id_documento_origen?: string | null;
      cantidad: number;
      fecha_vencimiento?: string | null;
      observaciones?: string | null;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const updated = await this.changeExistence(client, {
        key: {
          idProducto: input.id_producto,
          idBodega: input.id_bodega,
          idUbicacion: input.id_ubicacion ?? null,
          idLoteProducto: input.id_lote_producto ?? null,
        },
        changes: { cantidad_reservada: input.cantidad },
      });

      const disponibleReal =
        Number(updated.cantidad_disponible) -
        Number(updated.cantidad_reservada) -
        Number(updated.cantidad_bloqueada);
      if (disponibleReal < 0) {
        throw new BadRequestException("Inventario insuficiente para reservar");
      }

      const result = await client.query(
        `
        INSERT INTO inventario.reservas_inventario (
          id_producto, id_bodega, id_ubicacion, id_lote_producto,
          tipo_origen, id_documento_origen, cantidad, fecha_vencimiento,
          observaciones, creado_por
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          input.id_producto,
          input.id_bodega,
          input.id_ubicacion ?? null,
          input.id_lote_producto ?? null,
          input.tipo_origen,
          input.id_documento_origen ?? null,
          input.cantidad,
          input.fecha_vencimiento ?? null,
          input.observaciones ?? null,
          actor?.id_usuario ?? null,
        ],
      );
      return result.rows[0];
    });
  }

  async releaseExpiredReservations(actor?: AuthUser) {
    const reservations = await this.db.query<{ id_reserva_inventario: string }>(
      `
      SELECT id_reserva_inventario
      FROM inventario.reservas_inventario
      WHERE estado = 'ACTIVA'
        AND fecha_vencimiento IS NOT NULL
        AND fecha_vencimiento < now()
      `,
    );

    const released = [];
    for (const reservation of reservations.rows) {
      released.push(
        await this.releaseReservation(
          reservation.id_reserva_inventario,
          "VENCIDA",
          actor,
        ),
      );
    }

    return released;
  }

  async releaseReservation(
    reservationId: string,
    state: "LIBERADA" | "VENCIDA" = "LIBERADA",
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const reservation = await this.getReservationForUpdate(client, reservationId);
      if (reservation.estado !== "ACTIVA") {
        throw new BadRequestException("La reserva no está activa");
      }

      await this.changeExistence(client, {
        key: {
          idProducto: reservation.id_producto,
          idBodega: reservation.id_bodega,
          idUbicacion: reservation.id_ubicacion,
          idLoteProducto: reservation.id_lote_producto,
        },
        changes: { cantidad_reservada: -Number(reservation.cantidad) },
      });

      const result = await client.query(
        `
        UPDATE inventario.reservas_inventario
        SET estado = $1,
            fecha_actualizacion = now()
        WHERE id_reserva_inventario = $2
        RETURNING *
        `,
        [state, reservationId],
      );
      return result.rows[0];
    });
  }

  async consumeReservation(
    reservationId: string,
    input: { tipo_documento?: string; motivo?: string },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const reservation = await this.getReservationForUpdate(client, reservationId);
      if (reservation.estado !== "ACTIVA") {
        throw new BadRequestException("La reserva no está activa");
      }

      const documentId = await this.createDocument(client, {
        tipoDocumento: input.tipo_documento ?? "CONSUMO_RESERVA",
        prefijo: "RSV",
        numeroDocumento: this.generateNumber("RSV"),
        estado: "APROBADO",
        idBodegaOrigen: reservation.id_bodega,
        idBodegaDestino: null,
        idTercero: null,
        motivo: input.motivo ?? "Consumo de reserva",
        observaciones: reservation.observaciones,
        responsableId: actor?.id_usuario ?? null,
      });

      await this.stageMovement(client, {
        documentId,
        movementCode: "SALIDA_MANUAL",
        sign: -1,
        orderLine: 1,
        line: {
          id_producto: reservation.id_producto,
          id_bodega: reservation.id_bodega,
          id_ubicacion: reservation.id_ubicacion,
          id_lote_producto: reservation.id_lote_producto,
          cantidad: Number(reservation.cantidad),
          costo_unitario: 0,
          detalle: "Consumo de reserva",
        },
      });

      await this.applyDocumentWithClient(client, documentId, actor, {
        reservationAdjustment: {
          key: {
            idProducto: reservation.id_producto,
            idBodega: reservation.id_bodega,
            idUbicacion: reservation.id_ubicacion,
            idLoteProducto: reservation.id_lote_producto,
          },
          quantity: Number(reservation.cantidad),
        },
      });

      const result = await client.query(
        `
        UPDATE inventario.reservas_inventario
        SET estado = 'CONSUMIDA',
            fecha_actualizacion = now()
        WHERE id_reserva_inventario = $1
        RETURNING *
        `,
        [reservationId],
      );
      return result.rows[0];
    });
  }

  async createTransfer(
    input: {
      codigo?: string;
      id_bodega_origen: string;
      id_bodega_destino: string;
      observaciones?: string;
      referencia_externa?: string;
      detalles: Array<{
        id_producto: string;
        id_lote_producto?: string | null;
        cantidad_solicitada: number;
        costo_unitario?: number;
        observaciones?: string;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const header = await client.query(
        `
        INSERT INTO inventario.solicitudes_traslado (
          codigo, id_bodega_origen, id_bodega_destino, estado, solicitado_por,
          observaciones, referencia_externa
        )
        VALUES ($1, $2, $3, 'SOLICITADO', $4, $5, $6)
        RETURNING *
        `,
        [
          input.codigo ?? this.generateNumber("TRS"),
          input.id_bodega_origen,
          input.id_bodega_destino,
          actor?.id_usuario ?? null,
          input.observaciones ?? null,
          input.referencia_externa ?? null,
        ],
      );

      for (const detail of input.detalles) {
        await client.query(
          `
          INSERT INTO inventario.detalles_solicitud_traslado (
            id_solicitud_traslado, id_producto, id_lote_producto,
            cantidad_solicitada, costo_unitario, observaciones
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            header.rows[0].id_solicitud_traslado,
            detail.id_producto,
            detail.id_lote_producto ?? null,
            detail.cantidad_solicitada,
            detail.costo_unitario ?? 0,
            detail.observaciones ?? null,
          ],
        );
      }

      return header.rows[0];
    });
  }

  async approveTransfer(
    transferId: string,
    input: {
      detalles?: Array<{
        id_detalle_solicitud_traslado: string;
        cantidad_aprobada: number;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      if (input.detalles?.length) {
        for (const detail of input.detalles) {
          await client.query(
            `
            UPDATE inventario.detalles_solicitud_traslado
            SET cantidad_aprobada = $1
            WHERE id_detalle_solicitud_traslado = $2
            `,
            [detail.cantidad_aprobada, detail.id_detalle_solicitud_traslado],
          );
        }
      } else {
        await client.query(
          `
          UPDATE inventario.detalles_solicitud_traslado
          SET cantidad_aprobada = cantidad_solicitada
          WHERE id_solicitud_traslado = $1
          `,
          [transferId],
        );
      }

      const result = await client.query(
        `
        UPDATE inventario.solicitudes_traslado
        SET estado = 'APROBADO',
            fecha_aprobacion = now(),
            aprobado_por = $2,
            fecha_actualizacion = now()
        WHERE id_solicitud_traslado = $1
        RETURNING *
        `,
        [transferId, actor?.id_usuario ?? null],
      );
      return result.rows[0];
    });
  }

  async dispatchTransfer(transferId: string, actor?: AuthUser) {
    return this.db.withTransaction(async (client) => {
      const header = await this.getTransferForUpdate(client, transferId);
      const details = await client.query(
        `
        SELECT *
        FROM inventario.detalles_solicitud_traslado
        WHERE id_solicitud_traslado = $1
        ORDER BY fecha_creacion
        `,
        [transferId],
      );

      for (const detail of details.rows) {
        const quantity = Number(detail.cantidad_aprobada || detail.cantidad_solicitada);
        await this.changeExistence(client, {
          key: {
            idProducto: detail.id_producto,
            idBodega: header.id_bodega_origen,
            idUbicacion: null,
            idLoteProducto: detail.id_lote_producto,
          },
          changes: {
            cantidad_disponible: -quantity,
            cantidad_transito_salida: quantity,
          },
          costUnit: Number(detail.costo_unitario ?? 0),
        });

        await this.changeExistence(client, {
          key: {
            idProducto: detail.id_producto,
            idBodega: header.id_bodega_destino,
            idUbicacion: null,
            idLoteProducto: detail.id_lote_producto,
          },
          changes: { cantidad_transito_entrada: quantity },
          costUnit: Number(detail.costo_unitario ?? 0),
        });

        await client.query(
          `
          UPDATE inventario.detalles_solicitud_traslado
          SET cantidad_despachada = $2
          WHERE id_detalle_solicitud_traslado = $1
          `,
          [detail.id_detalle_solicitud_traslado, quantity],
        );
      }

      const result = await client.query(
        `
        UPDATE inventario.solicitudes_traslado
        SET estado = 'DESPACHADO',
            fecha_despacho = now(),
            despachado_por = $2,
            fecha_actualizacion = now()
        WHERE id_solicitud_traslado = $1
        RETURNING *
        `,
        [transferId, actor?.id_usuario ?? null],
      );
      return result.rows[0];
    });
  }

  async receiveTransfer(transferId: string, actor?: AuthUser) {
    return this.db.withTransaction(async (client) => {
      const header = await this.getTransferForUpdate(client, transferId);
      const details = await client.query(
        `
        SELECT *
        FROM inventario.detalles_solicitud_traslado
        WHERE id_solicitud_traslado = $1
        ORDER BY fecha_creacion
        `,
        [transferId],
      );

      for (const detail of details.rows) {
        const quantity = Number(detail.cantidad_despachada || detail.cantidad_aprobada);
        await this.changeExistence(client, {
          key: {
            idProducto: detail.id_producto,
            idBodega: header.id_bodega_origen,
            idUbicacion: null,
            idLoteProducto: detail.id_lote_producto,
          },
          changes: { cantidad_transito_salida: -quantity },
          costUnit: Number(detail.costo_unitario ?? 0),
        });

        await this.changeExistence(client, {
          key: {
            idProducto: detail.id_producto,
            idBodega: header.id_bodega_destino,
            idUbicacion: null,
            idLoteProducto: detail.id_lote_producto,
          },
          changes: {
            cantidad_transito_entrada: -quantity,
            cantidad_disponible: quantity,
          },
          costUnit: Number(detail.costo_unitario ?? 0),
        });

        await client.query(
          `
          UPDATE inventario.detalles_solicitud_traslado
          SET cantidad_recibida = $2
          WHERE id_detalle_solicitud_traslado = $1
          `,
          [detail.id_detalle_solicitud_traslado, quantity],
        );
      }

      const result = await client.query(
        `
        UPDATE inventario.solicitudes_traslado
        SET estado = 'RECIBIDO',
            fecha_recepcion = now(),
            recibido_por = $2,
            fecha_actualizacion = now()
        WHERE id_solicitud_traslado = $1
        RETURNING *
        `,
        [transferId, actor?.id_usuario ?? null],
      );
      return result.rows[0];
    });
  }

  async createInternalTransfer(
    input: {
      codigo?: string;
      id_bodega: string;
      id_ubicacion_origen: string;
      id_ubicacion_destino: string;
      motivo?: string;
      observaciones?: string;
      detalles: Array<{
        id_producto: string;
        id_lote_producto?: string | null;
        cantidad: number;
        costo_unitario?: number;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const header = await client.query(
        `
        INSERT INTO inventario.transferencias_internas_ubicacion (
          codigo, id_bodega, id_ubicacion_origen, id_ubicacion_destino,
          estado, motivo, creado_por, observaciones
        )
        VALUES ($1, $2, $3, $4, 'APROBADA', $5, $6, $7)
        RETURNING *
        `,
        [
          input.codigo ?? this.generateNumber("TIN"),
          input.id_bodega,
          input.id_ubicacion_origen,
          input.id_ubicacion_destino,
          input.motivo ?? null,
          actor?.id_usuario ?? null,
          input.observaciones ?? null,
        ],
      );

      for (const detail of input.detalles) {
        await client.query(
          `
          INSERT INTO inventario.detalles_transferencia_interna_ubicacion (
            id_transferencia_interna_ubicacion, id_producto, id_lote_producto, cantidad, costo_unitario
          )
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            header.rows[0].id_transferencia_interna_ubicacion,
            detail.id_producto,
            detail.id_lote_producto ?? null,
            detail.cantidad,
            detail.costo_unitario ?? 0,
          ],
        );
      }

      return header.rows[0];
    });
  }

  async applyInternalTransfer(transferId: string, actor?: AuthUser) {
    return this.db.withTransaction(async (client) => {
      const headerResult = await client.query(
        `
        SELECT *
        FROM inventario.transferencias_internas_ubicacion
        WHERE id_transferencia_interna_ubicacion = $1
        FOR UPDATE
        `,
        [transferId],
      );
      const header = headerResult.rows[0];
      const details = await client.query(
        `
        SELECT *
        FROM inventario.detalles_transferencia_interna_ubicacion
        WHERE id_transferencia_interna_ubicacion = $1
        `,
        [transferId],
      );

      for (const detail of details.rows) {
        await this.changeExistence(client, {
          key: {
            idProducto: detail.id_producto,
            idBodega: header.id_bodega,
            idUbicacion: header.id_ubicacion_origen,
            idLoteProducto: detail.id_lote_producto,
          },
          changes: { cantidad_disponible: -Number(detail.cantidad) },
          costUnit: Number(detail.costo_unitario ?? 0),
        });

        await this.changeExistence(client, {
          key: {
            idProducto: detail.id_producto,
            idBodega: header.id_bodega,
            idUbicacion: header.id_ubicacion_destino,
            idLoteProducto: detail.id_lote_producto,
          },
          changes: { cantidad_disponible: Number(detail.cantidad) },
          costUnit: Number(detail.costo_unitario ?? 0),
        });
      }

      const result = await client.query(
        `
        UPDATE inventario.transferencias_internas_ubicacion
        SET estado = 'APLICADA',
            aplicado_por = $2,
            fecha_actualizacion = now()
        WHERE id_transferencia_interna_ubicacion = $1
        RETURNING *
        `,
        [transferId, actor?.id_usuario ?? null],
      );
      return result.rows[0];
    });
  }

  async createCount(
    input: {
      codigo?: string;
      tipo_conteo: string;
      id_bodega: string;
      fecha_programada: string;
      congelar_movimientos?: boolean;
      observaciones?: string;
      detalles?: Array<{
        id_producto: string;
        id_ubicacion?: string | null;
        id_lote_producto?: string | null;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const header = await client.query(
        `
        INSERT INTO inventario.conteos_inventario (
          codigo, tipo_conteo, id_bodega, estado, fecha_programada,
          congelar_movimientos, observaciones, creado_por
        )
        VALUES ($1, $2, $3, 'PROGRAMADO', $4, $5, $6, $7)
        RETURNING *
        `,
        [
          input.codigo ?? this.generateNumber("CNT"),
          input.tipo_conteo,
          input.id_bodega,
          input.fecha_programada,
          input.congelar_movimientos ?? false,
          input.observaciones ?? null,
          actor?.id_usuario ?? null,
        ],
      );

      for (const detail of input.detalles ?? []) {
        const systemQty = await this.getSystemQuantity(
          client,
          detail.id_producto,
          input.id_bodega,
          detail.id_ubicacion ?? null,
          detail.id_lote_producto ?? null,
        );
        await client.query(
          `
          INSERT INTO inventario.detalles_conteo_inventario (
            id_conteo_inventario, id_producto, id_ubicacion, id_lote_producto, cantidad_sistema
          )
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            header.rows[0].id_conteo_inventario,
            detail.id_producto,
            detail.id_ubicacion ?? null,
            detail.id_lote_producto ?? null,
            systemQty,
          ],
        );
      }

      return header.rows[0];
    });
  }

  async startCount(countId: string) {
    const result = await this.db.query(
      `
      UPDATE inventario.conteos_inventario
      SET estado = 'EN_EJECUCION',
          fecha_inicio = now(),
          fecha_actualizacion = now()
      WHERE id_conteo_inventario = $1
      RETURNING *
      `,
      [countId],
    );
    return result.rows[0];
  }

  async registerCountLine(
    countId: string,
    input: {
      id_producto: string;
      id_ubicacion?: string | null;
      id_lote_producto?: string | null;
      cantidad_contada: number;
      observaciones?: string;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const countResult = await client.query(
        "SELECT * FROM inventario.conteos_inventario WHERE id_conteo_inventario = $1 FOR UPDATE",
        [countId],
      );
      if (!countResult.rows.length) {
        throw new BadRequestException("Conteo no encontrado");
      }

      const count = countResult.rows[0];
      const systemQty = await this.getSystemQuantity(
        client,
        input.id_producto,
        count.id_bodega,
        input.id_ubicacion ?? null,
        input.id_lote_producto ?? null,
      );

      const existing = await client.query(
        `
        SELECT id_detalle_conteo_inventario
        FROM inventario.detalles_conteo_inventario
        WHERE id_conteo_inventario = $1
          AND id_producto = $2
          AND id_ubicacion IS NOT DISTINCT FROM $3
          AND id_lote_producto IS NOT DISTINCT FROM $4
        `,
        [
          countId,
          input.id_producto,
          input.id_ubicacion ?? null,
          input.id_lote_producto ?? null,
        ],
      );

      if (existing.rows.length) {
        const result = await client.query(
          `
          UPDATE inventario.detalles_conteo_inventario
          SET cantidad_sistema = $2,
              cantidad_contada = $3,
              observaciones = $4,
              contado_por = $5,
              fecha_conteo = now(),
              reconteo_requerido = CASE
                WHEN abs(($3::numeric) - ($2::numeric)) > 0 THEN true
                ELSE false
              END
          WHERE id_detalle_conteo_inventario = $1
          RETURNING *
          `,
          [
            existing.rows[0].id_detalle_conteo_inventario,
            systemQty,
            input.cantidad_contada,
            input.observaciones ?? null,
            actor?.id_usuario ?? null,
          ],
        );
        return result.rows[0];
      }

      const result = await client.query(
        `
        INSERT INTO inventario.detalles_conteo_inventario (
          id_conteo_inventario, id_producto, id_ubicacion, id_lote_producto,
          cantidad_sistema, cantidad_contada, observaciones, contado_por,
          reconteo_requerido, fecha_conteo
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          CASE
            WHEN abs(($6::numeric) - ($5::numeric)) > 0 THEN true
            ELSE false
          END,
          now()
        )
        RETURNING *
        `,
        [
          countId,
          input.id_producto,
          input.id_ubicacion ?? null,
          input.id_lote_producto ?? null,
          systemQty,
          input.cantidad_contada,
          input.observaciones ?? null,
          actor?.id_usuario ?? null,
        ],
      );
      return result.rows[0];
    });
  }

  async closeCount(countId: string, actor?: AuthUser) {
    return this.db.withTransaction(async (client) => {
      const countResult = await client.query(
        "SELECT * FROM inventario.conteos_inventario WHERE id_conteo_inventario = $1 FOR UPDATE",
        [countId],
      );
      const count = countResult.rows[0];

      const details = await client.query(
        `
        SELECT *
        FROM inventario.detalles_conteo_inventario
        WHERE id_conteo_inventario = $1
          AND diferencia <> 0
        `,
        [countId],
      );

      const header = await client.query(
        `
        INSERT INTO inventario.ajustes_inventario (
          codigo, tipo_ajuste, id_bodega, estado, motivo, observaciones, creado_por
        )
        VALUES ($1, 'DIFERENCIA_CONTEO', $2, 'PENDIENTE_APROBACION', $3, $4, $5)
        RETURNING *
        `,
        [
          this.generateNumber("AJT"),
          count.id_bodega,
          `Ajuste generado desde conteo ${count.codigo}`,
          count.observaciones ?? null,
          actor?.id_usuario ?? null,
        ],
      );

      for (const detail of details.rows) {
        await client.query(
          `
          INSERT INTO inventario.detalles_ajuste_inventario (
            id_ajuste_inventario, id_producto, id_ubicacion, id_lote_producto,
            cantidad_sistema, cantidad_ajuste, costo_unitario, observaciones
          )
          VALUES ($1, $2, $3, $4, $5, $6, 0, $7)
          `,
          [
            header.rows[0].id_ajuste_inventario,
            detail.id_producto,
            detail.id_ubicacion,
            detail.id_lote_producto,
            detail.cantidad_sistema,
            detail.diferencia,
            detail.observaciones ?? "Ajuste desde conteo",
          ],
        );
      }

      const closedCount = await client.query(
        `
        UPDATE inventario.conteos_inventario
        SET estado = 'CERRADO',
            fecha_cierre = now(),
            cerrado_por = $2,
            fecha_actualizacion = now()
        WHERE id_conteo_inventario = $1
        RETURNING *
        `,
        [countId, actor?.id_usuario ?? null],
      );

      return {
        count: closedCount.rows[0],
        generated_adjustment: header.rows[0],
      };
    });
  }

  async createAdjustment(
    input: {
      codigo?: string;
      tipo_ajuste: string;
      id_bodega: string;
      motivo: string;
      evidencia_url?: string;
      observaciones?: string;
      valor_estimado?: number;
      detalles: Array<{
        id_producto: string;
        id_ubicacion?: string | null;
        id_lote_producto?: string | null;
        cantidad_ajuste: number;
        costo_unitario?: number;
        observaciones?: string;
      }>;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      const header = await client.query(
        `
        INSERT INTO inventario.ajustes_inventario (
          codigo, tipo_ajuste, id_bodega, estado, motivo, evidencia_url,
          observaciones, valor_estimado, creado_por
        )
        VALUES ($1, $2, $3, 'PENDIENTE_APROBACION', $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          input.codigo ?? this.generateNumber("AJT"),
          input.tipo_ajuste,
          input.id_bodega,
          input.motivo,
          input.evidencia_url ?? null,
          input.observaciones ?? null,
          input.valor_estimado ?? null,
          actor?.id_usuario ?? null,
        ],
      );

      for (const detail of input.detalles) {
        const systemQty = await this.getSystemQuantity(
          client,
          detail.id_producto,
          input.id_bodega,
          detail.id_ubicacion ?? null,
          detail.id_lote_producto ?? null,
        );
        await client.query(
          `
          INSERT INTO inventario.detalles_ajuste_inventario (
            id_ajuste_inventario, id_producto, id_ubicacion, id_lote_producto,
            cantidad_sistema, cantidad_ajuste, costo_unitario, observaciones
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            header.rows[0].id_ajuste_inventario,
            detail.id_producto,
            detail.id_ubicacion ?? null,
            detail.id_lote_producto ?? null,
            systemQty,
            detail.cantidad_ajuste,
            detail.costo_unitario ?? 0,
            detail.observaciones ?? null,
          ],
        );
      }

      return header.rows[0];
    });
  }

  async approveAdjustment(adjustmentId: string, actor?: AuthUser) {
    const result = await this.db.query(
      `
      UPDATE inventario.ajustes_inventario
      SET estado = 'APROBADO',
          aprobado_por = $2,
          fecha_aprobacion = now(),
          fecha_actualizacion = now()
      WHERE id_ajuste_inventario = $1
      RETURNING *
      `,
      [adjustmentId, actor?.id_usuario ?? null],
    );
    return result.rows[0];
  }

  async applyAdjustment(adjustmentId: string, actor?: AuthUser) {
    return this.db.withTransaction(async (client) => {
      const adjustment = await client.query(
        `
        SELECT *
        FROM inventario.ajustes_inventario
        WHERE id_ajuste_inventario = $1
        FOR UPDATE
        `,
        [adjustmentId],
      );
      if (!adjustment.rows.length) {
        throw new BadRequestException("Ajuste no encontrado");
      }

      if (adjustment.rows[0].estado !== "APROBADO") {
        throw new BadRequestException(
          "El ajuste debe estar aprobado antes de aplicarse",
        );
      }

      const details = await client.query(
        `
        SELECT *
        FROM inventario.detalles_ajuste_inventario
        WHERE id_ajuste_inventario = $1
        `,
        [adjustmentId],
      );

      for (const detail of details.rows) {
        await this.changeExistence(client, {
          key: {
            idProducto: detail.id_producto,
            idBodega: adjustment.rows[0].id_bodega,
            idUbicacion: detail.id_ubicacion,
            idLoteProducto: detail.id_lote_producto,
          },
          changes: { cantidad_disponible: Number(detail.cantidad_ajuste) },
          costUnit: Number(detail.costo_unitario ?? 0),
        });
      }

      const result = await client.query(
        `
        UPDATE inventario.ajustes_inventario
        SET estado = 'APLICADO',
            aplicado_por = $2,
            fecha_aplicacion = now(),
            fecha_actualizacion = now()
        WHERE id_ajuste_inventario = $1
        RETURNING *
        `,
        [adjustmentId, actor?.id_usuario ?? null],
      );
      return result.rows[0];
    });
  }

  async blockInventory(
    input: {
      id_producto: string;
      id_bodega: string;
      id_ubicacion?: string | null;
      id_lote_producto?: string | null;
      tipo_bloqueo: string;
      cantidad_bloqueada: number;
      motivo: string;
      fecha_fin?: string | null;
      observaciones?: string | null;
    },
    actor?: AuthUser,
  ) {
    return this.db.withTransaction(async (client) => {
      await this.changeExistence(client, {
        key: {
          idProducto: input.id_producto,
          idBodega: input.id_bodega,
          idUbicacion: input.id_ubicacion ?? null,
          idLoteProducto: input.id_lote_producto ?? null,
        },
        changes: {
          cantidad_disponible: -input.cantidad_bloqueada,
          cantidad_bloqueada: input.cantidad_bloqueada,
        },
      });

      const result = await client.query(
        `
        INSERT INTO inventario.bloqueos_inventario (
          id_producto, id_bodega, id_ubicacion, id_lote_producto,
          tipo_bloqueo, cantidad_bloqueada, fecha_fin, motivo,
          creado_por, observaciones
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          input.id_producto,
          input.id_bodega,
          input.id_ubicacion ?? null,
          input.id_lote_producto ?? null,
          input.tipo_bloqueo,
          input.cantidad_bloqueada,
          input.fecha_fin ?? null,
          input.motivo,
          actor?.id_usuario ?? null,
          input.observaciones ?? null,
        ],
      );
      return result.rows[0];
    });
  }

  async releaseBlock(blockId: string, actor?: AuthUser) {
    return this.db.withTransaction(async (client) => {
      const blockResult = await client.query(
        `
        SELECT *
        FROM inventario.bloqueos_inventario
        WHERE id_bloqueo_inventario = $1
        FOR UPDATE
        `,
        [blockId],
      );
      const block = blockResult.rows[0];
      if (!block || block.estado !== "ACTIVO") {
        throw new BadRequestException("Bloqueo no activo");
      }

      await this.changeExistence(client, {
        key: {
          idProducto: block.id_producto,
          idBodega: block.id_bodega,
          idUbicacion: block.id_ubicacion,
          idLoteProducto: block.id_lote_producto,
        },
        changes: {
          cantidad_disponible: Number(block.cantidad_bloqueada),
          cantidad_bloqueada: -Number(block.cantidad_bloqueada),
        },
      });

      const result = await client.query(
        `
        UPDATE inventario.bloqueos_inventario
        SET estado = 'LIBERADO',
            liberado_por = $2,
            fecha_liberacion = now()
        WHERE id_bloqueo_inventario = $1
        RETURNING *
        `,
        [blockId, actor?.id_usuario ?? null],
      );
      return result.rows[0];
    });
  }

  async ensureLot(
    client: PoolClient,
    input: {
      id_producto: string;
      numero_lote: string;
      fecha_fabricacion?: string | null;
      fecha_vencimiento?: string | null;
      id_registro_sanitario_producto?: string | null;
    },
  ) {
    const existing = await client.query(
      `
      SELECT *
      FROM inventario.lotes_producto
      WHERE id_producto = $1 AND numero_lote = $2
      `,
      [input.id_producto, input.numero_lote],
    );

    if (existing.rows.length) {
      return existing.rows[0];
    }

    const created = await client.query(
      `
      INSERT INTO inventario.lotes_producto (
        id_producto, numero_lote, fecha_fabricacion,
        fecha_vencimiento, id_registro_sanitario_producto
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        input.id_producto,
        input.numero_lote,
        input.fecha_fabricacion ?? null,
        input.fecha_vencimiento ?? null,
        input.id_registro_sanitario_producto ?? null,
      ],
    );
    return created.rows[0];
  }

  async createMovementDocument(
    client: PoolClient,
    input: {
      tipoDocumento: string;
      prefijo?: string;
      numeroDocumento?: string;
      estado?: string;
      idBodegaOrigen?: string | null;
      idBodegaDestino?: string | null;
      motivo?: string | null;
      observaciones?: string | null;
      responsableId?: string | null;
      idTercero?: string | null;
    },
  ) {
    return this.createDocument(client, {
      tipoDocumento: input.tipoDocumento,
      prefijo: input.prefijo ?? "DOC",
      numeroDocumento: input.numeroDocumento ?? this.generateNumber("DOC"),
      estado: input.estado ?? "APROBADO",
      idBodegaOrigen: input.idBodegaOrigen ?? null,
      idBodegaDestino: input.idBodegaDestino ?? null,
      idTercero: input.idTercero ?? null,
      motivo: input.motivo ?? null,
      observaciones: input.observaciones ?? null,
      responsableId: input.responsableId ?? null,
    });
  }

  async decreaseInventory(
    client: PoolClient,
    params: {
      movementCode: string;
      documentId: string;
      line: InventoryLine;
      orderLine: number;
    },
  ) {
    await this.stageMovement(client, {
      documentId: params.documentId,
      movementCode: params.movementCode,
      sign: -1,
      line: params.line,
      orderLine: params.orderLine,
    });

    return this.changeExistence(client, {
      key: {
        idProducto: params.line.id_producto,
        idBodega: params.line.id_bodega,
        idUbicacion: params.line.id_ubicacion ?? null,
        idLoteProducto: params.line.id_lote_producto ?? null,
      },
      changes: { cantidad_disponible: -params.line.cantidad },
      costUnit: params.line.costo_unitario ?? 0,
    });
  }

  async increaseInventory(
    client: PoolClient,
    params: {
      movementCode: string;
      documentId: string;
      line: InventoryLine;
      orderLine: number;
    },
  ) {
    await this.stageMovement(client, {
      documentId: params.documentId,
      movementCode: params.movementCode,
      sign: 1,
      line: params.line,
      orderLine: params.orderLine,
    });

    return this.changeExistence(client, {
      key: {
        idProducto: params.line.id_producto,
        idBodega: params.line.id_bodega,
        idUbicacion: params.line.id_ubicacion ?? null,
        idLoteProducto: params.line.id_lote_producto ?? null,
      },
      changes: { cantidad_disponible: params.line.cantidad },
      costUnit: params.line.costo_unitario ?? 0,
    });
  }

  private async applyDocumentWithClient(
    client: PoolClient,
    documentId: string,
    actor?: AuthUser,
    options?: {
      reservationAdjustment?: {
        key: ExistenceKey;
        quantity: number;
      };
    },
  ) {
    const document = await this.getMovementDocumentById(client, documentId, true);
    if (document.estado === "APLICADO") {
      return document;
    }

    const movements = await client.query(
      `
      SELECT m.*
      FROM inventario.movimientos_inventario m
      WHERE id_documento_movimiento_inventario = $1
      ORDER BY orden_linea
      `,
      [documentId],
    );

    if (options?.reservationAdjustment) {
      await this.changeExistence(client, {
        key: options.reservationAdjustment.key,
        changes: { cantidad_reservada: -options.reservationAdjustment.quantity },
      });
    }

    for (const movement of movements.rows) {
      const updated = await this.changeExistence(client, {
        key: {
          idProducto: movement.id_producto,
          idBodega: movement.id_bodega,
          idUbicacion: movement.id_ubicacion,
          idLoteProducto: movement.id_lote_producto,
        },
        changes: {
          cantidad_disponible: Number(movement.cantidad) * Number(movement.signo),
        },
        costUnit: Number(movement.costo_unitario ?? 0),
      });

      await client.query(
        `
        UPDATE inventario.movimientos_inventario
        SET saldo_cantidad_anterior = $2,
            saldo_cantidad_nuevo = $3,
            saldo_valor_anterior = $4,
            saldo_valor_nuevo = $5,
            fecha_movimiento = now()
        WHERE id_movimiento_inventario = $1
        `,
        [
          movement.id_movimiento_inventario,
          updated.__before_qty,
          updated.cantidad_disponible,
          Number(updated.__before_qty) * Number(updated.__before_cost),
          Number(updated.cantidad_disponible) * Number(updated.costo_promedio),
        ],
      );
    }

    await client.query(
      `
      UPDATE inventario.documentos_movimiento_inventario
      SET estado = 'APLICADO',
          fecha_aplicacion = now(),
          aplicado_por = $2,
          fecha_actualizacion = now()
      WHERE id_documento_movimiento_inventario = $1
      `,
      [documentId, actor?.id_usuario ?? null],
    );

    return this.getMovementDocumentById(client, documentId);
  }

  private async stageMovement(
    client: PoolClient,
    input: {
      documentId: string;
      movementCode: string;
      sign: -1 | 1;
      line: InventoryLine;
      orderLine: number;
    },
  ) {
    const typeId = await this.getMovementTypeId(client, input.movementCode);
    await client.query(
      `
      INSERT INTO inventario.movimientos_inventario (
        id_documento_movimiento_inventario, id_tipo_movimiento_inventario,
        id_producto, id_bodega, id_ubicacion, id_lote_producto,
        cantidad, costo_unitario, signo, detalle, orden_linea
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        input.documentId,
        typeId,
        input.line.id_producto,
        input.line.id_bodega,
        input.line.id_ubicacion ?? null,
        input.line.id_lote_producto ?? null,
        input.line.cantidad,
        input.line.costo_unitario ?? 0,
        input.sign,
        input.line.detalle ?? null,
        input.orderLine,
      ],
    );
  }

  private async getTransferForUpdate(client: PoolClient, transferId: string) {
    const result = await client.query(
      `
      SELECT *
      FROM inventario.solicitudes_traslado
      WHERE id_solicitud_traslado = $1
      FOR UPDATE
      `,
      [transferId],
    );
    return result.rows[0];
  }

  private async getReservationForUpdate(client: PoolClient, reservationId: string) {
    const result = await client.query(
      `
      SELECT *
      FROM inventario.reservas_inventario
      WHERE id_reserva_inventario = $1
      FOR UPDATE
      `,
      [reservationId],
    );
    return result.rows[0];
  }

  private async getMovementDocumentById(
    client: PoolClient,
    documentId: string,
    forUpdate = false,
  ) {
    const result = await client.query(
      `
      SELECT *
      FROM inventario.documentos_movimiento_inventario
      WHERE id_documento_movimiento_inventario = $1
      ${forUpdate ? "FOR UPDATE" : ""}
      `,
      [documentId],
    );
    return result.rows[0];
  }

  private async createDocument(
    client: PoolClient,
    input: {
      tipoDocumento: string;
      prefijo: string;
      numeroDocumento: string;
      estado: string;
      idBodegaOrigen?: string | null;
      idBodegaDestino?: string | null;
      idTercero?: string | null;
      motivo?: string | null;
      observaciones?: string | null;
      responsableId?: string | null;
    },
  ) {
    const result = await client.query(
      `
      INSERT INTO inventario.documentos_movimiento_inventario (
        tipo_documento, prefijo, numero_documento, estado, id_bodega_origen,
        id_bodega_destino, id_tercero, id_usuario_responsable, motivo, observaciones
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id_documento_movimiento_inventario
      `,
      [
        input.tipoDocumento,
        input.prefijo,
        input.numeroDocumento,
        input.estado,
        input.idBodegaOrigen ?? null,
        input.idBodegaDestino ?? null,
        input.idTercero ?? null,
        input.responsableId ?? null,
        input.motivo ?? null,
        input.observaciones ?? null,
      ],
    );
    return result.rows[0].id_documento_movimiento_inventario as string;
  }

  private async getMovementTypeId(client: PoolClient, code: string) {
    const result = await client.query(
      `
      SELECT id_tipo_movimiento_inventario
      FROM inventario.tipos_movimiento_inventario
      WHERE codigo = $1
      `,
      [code],
    );
    if (!result.rows.length) {
      throw new BadRequestException(
        `Tipo de movimiento no configurado: ${code}`,
      );
    }
    return result.rows[0].id_tipo_movimiento_inventario as string;
  }

  private async getExistenceForUpdate(client: PoolClient, key: ExistenceKey) {
    const result = await client.query(
      `
      SELECT *
      FROM inventario.existencias
      WHERE id_producto = $1
        AND id_bodega = $2
        AND id_ubicacion IS NOT DISTINCT FROM $3
        AND id_lote_producto IS NOT DISTINCT FROM $4
      FOR UPDATE
      `,
      [
        key.idProducto,
        key.idBodega,
        key.idUbicacion ?? null,
        key.idLoteProducto ?? null,
      ],
    );
    return result.rows[0];
  }

  private async changeExistence(
    client: PoolClient,
    input: {
      key: ExistenceKey;
      changes: Partial<
        Record<
          | "cantidad_disponible"
          | "cantidad_reservada"
          | "cantidad_bloqueada"
          | "cantidad_transito_entrada"
          | "cantidad_transito_salida",
          number
        >
      >;
      costUnit?: number;
    },
  ) {
    const current = await this.getExistenceForUpdate(client, input.key);
    const before = current
      ? {
          cantidad_disponible: Number(current.cantidad_disponible),
          cantidad_reservada: Number(current.cantidad_reservada),
          cantidad_bloqueada: Number(current.cantidad_bloqueada),
          cantidad_transito_entrada: Number(current.cantidad_transito_entrada),
          cantidad_transito_salida: Number(current.cantidad_transito_salida),
          costo_promedio: Number(current.costo_promedio),
        }
      : {
          cantidad_disponible: 0,
          cantidad_reservada: 0,
          cantidad_bloqueada: 0,
          cantidad_transito_entrada: 0,
          cantidad_transito_salida: 0,
          costo_promedio: 0,
        };

    const next = {
      cantidad_disponible:
        before.cantidad_disponible + Number(input.changes.cantidad_disponible ?? 0),
      cantidad_reservada:
        before.cantidad_reservada + Number(input.changes.cantidad_reservada ?? 0),
      cantidad_bloqueada:
        before.cantidad_bloqueada + Number(input.changes.cantidad_bloqueada ?? 0),
      cantidad_transito_entrada:
        before.cantidad_transito_entrada +
        Number(input.changes.cantidad_transito_entrada ?? 0),
      cantidad_transito_salida:
        before.cantidad_transito_salida +
        Number(input.changes.cantidad_transito_salida ?? 0),
    };

    for (const [key, value] of Object.entries(next)) {
      if (value < 0) {
        throw new BadRequestException(`Saldo negativo no permitido en ${key}`);
      }
    }

    let nextCost = before.costo_promedio;
    const deltaAvailable = Number(input.changes.cantidad_disponible ?? 0);
    if (deltaAvailable > 0 && input.costUnit !== undefined) {
      const currentValue = before.cantidad_disponible * before.costo_promedio;
      const incomingValue = deltaAvailable * Number(input.costUnit);
      nextCost =
        next.cantidad_disponible > 0
          ? (currentValue + incomingValue) / next.cantidad_disponible
          : before.costo_promedio;
    }

    if (current) {
      const result = await client.query(
        `
        UPDATE inventario.existencias
        SET cantidad_disponible = $2,
            cantidad_reservada = $3,
            cantidad_bloqueada = $4,
            cantidad_transito_entrada = $5,
            cantidad_transito_salida = $6,
            costo_promedio = $7,
            fecha_ultima_movilizacion = now(),
            fecha_actualizacion = now()
        WHERE id_existencia = $1
        RETURNING *
        `,
        [
          current.id_existencia,
          next.cantidad_disponible,
          next.cantidad_reservada,
          next.cantidad_bloqueada,
          next.cantidad_transito_entrada,
          next.cantidad_transito_salida,
          nextCost,
        ],
      );
      return {
        ...result.rows[0],
        __before_qty: before.cantidad_disponible,
        __before_cost: before.costo_promedio,
      };
    }

    const result = await client.query(
      `
      INSERT INTO inventario.existencias (
        id_producto, id_bodega, id_ubicacion, id_lote_producto,
        cantidad_disponible, cantidad_reservada, cantidad_bloqueada,
        cantidad_transito_entrada, cantidad_transito_salida,
        costo_promedio, fecha_ultima_movilizacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      RETURNING *
      `,
      [
        input.key.idProducto,
        input.key.idBodega,
        input.key.idUbicacion ?? null,
        input.key.idLoteProducto ?? null,
        next.cantidad_disponible,
        next.cantidad_reservada,
        next.cantidad_bloqueada,
        next.cantidad_transito_entrada,
        next.cantidad_transito_salida,
        nextCost,
      ],
    );

    return {
      ...result.rows[0],
      __before_qty: before.cantidad_disponible,
      __before_cost: before.costo_promedio,
    };
  }

  private async getSystemQuantity(
    client: PoolClient,
    idProducto: string,
    idBodega: string,
    idUbicacion?: string | null,
    idLoteProducto?: string | null,
  ) {
    const result = await client.query(
      `
      SELECT coalesce(cantidad_disponible, 0) AS cantidad_disponible
      FROM inventario.existencias
      WHERE id_producto = $1
        AND id_bodega = $2
        AND id_ubicacion IS NOT DISTINCT FROM $3
        AND id_lote_producto IS NOT DISTINCT FROM $4
      `,
      [idProducto, idBodega, idUbicacion ?? null, idLoteProducto ?? null],
    );
    return Number(result.rows[0]?.cantidad_disponible ?? 0);
  }

  private generateNumber(prefix: string) {
    return `${prefix}-${Date.now()}`;
  }

  private getConfig(entity: string) {
    const config = INVENTORY_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new BadRequestException(
        `Entidad de inventario no soportada: ${entity}`,
      );
    }
    return config;
  }
}

@ApiTags("Inventory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("inventory.manage")
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("catalog")
  @ApiOperation({ summary: "Listar entidades operativas de inventario" })
  async catalog() {
    return this.inventoryService.getCatalog();
  }

  @Get("stock")
  @ApiOperation({
    summary: "Consultar stock por producto, bodega, ubicación y lote",
  })
  async stock(@Query() query: Record<string, unknown>) {
    return this.inventoryService.listStock(query);
  }

  @Get("kardex")
  @ApiOperation({ summary: "Consultar kardex y trazabilidad" })
  async kardex(@Query() query: Record<string, unknown>) {
    return this.inventoryService.kardex(query);
  }

  @Post("manual-documents")
  @ApiOperation({ summary: "Crear entrada o salida manual controlada" })
  async createManualDocument(
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.createManualDocument(
      payload as unknown as {
        tipo_documento: string;
        movement_code: "ENTRADA_MANUAL" | "SALIDA_MANUAL";
        lines: InventoryLine[];
      },
      user,
    );
  }

  @Post("documents/:id/apply")
  @ApiOperation({ summary: "Aplicar documento de movimiento inventario" })
  async applyDocument(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.applyDocument(id, user);
  }

  @Post("reservations")
  @ApiOperation({ summary: "Reservar inventario" })
  async reserve(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.reserveInventory(
      payload as unknown as {
        id_producto: string;
        id_bodega: string;
        tipo_origen: string;
        cantidad: number;
      },
      user,
    );
  }

  @Post("reservations/release-expired")
  @ApiOperation({ summary: "Liberar reservas vencidas" })
  async releaseExpired(@CurrentUser() user: AuthUser) {
    return this.inventoryService.releaseExpiredReservations(user);
  }

  @Post("reservations/:id/release")
  @ApiOperation({ summary: "Liberar una reserva" })
  async releaseReservation(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.releaseReservation(id, "LIBERADA", user);
  }

  @Post("reservations/:id/consume")
  @ApiOperation({ summary: "Consumir una reserva" })
  async consumeReservation(
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.consumeReservation(
      id,
      payload as unknown as { tipo_documento?: string; motivo?: string },
      user,
    );
  }

  @Post("transfers")
  @ApiOperation({ summary: "Crear solicitud de traslado entre bodegas" })
  async createTransfer(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createTransfer(
      payload as unknown as {
        id_bodega_origen: string;
        id_bodega_destino: string;
        detalles: Array<{ id_producto: string; cantidad_solicitada: number }>;
      },
      user,
    );
  }

  @Post("transfers/:id/approve")
  @ApiOperation({ summary: "Aprobar traslado entre bodegas" })
  async approveTransfer(
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.approveTransfer(
      id,
      payload as unknown as {
        detalles?: Array<{
          id_detalle_solicitud_traslado: string;
          cantidad_aprobada: number;
        }>;
      },
      user,
    );
  }

  @Post("transfers/:id/dispatch")
  @ApiOperation({ summary: "Despachar traslado entre bodegas" })
  async dispatchTransfer(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.dispatchTransfer(id, user);
  }

  @Post("transfers/:id/receive")
  @ApiOperation({ summary: "Recibir traslado entre bodegas" })
  async receiveTransfer(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.receiveTransfer(id, user);
  }

  @Post("internal-transfers")
  @ApiOperation({ summary: "Crear transferencia interna entre ubicaciones" })
  async createInternalTransfer(
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.createInternalTransfer(
      payload as unknown as {
        id_bodega: string;
        id_ubicacion_origen: string;
        id_ubicacion_destino: string;
        detalles: Array<{ id_producto: string; cantidad: number }>;
      },
      user,
    );
  }

  @Post("internal-transfers/:id/apply")
  @ApiOperation({ summary: "Aplicar transferencia interna entre ubicaciones" })
  async applyInternalTransfer(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.applyInternalTransfer(id, user);
  }

  @Post("counts")
  @ApiOperation({ summary: "Crear conteo cíclico o general" })
  async createCount(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createCount(
      payload as unknown as {
        tipo_conteo: string;
        id_bodega: string;
        fecha_programada: string;
      },
      user,
    );
  }

  @Post("counts/:id/start")
  @ApiOperation({ summary: "Iniciar conteo" })
  async startCount(@Param("id") id: string) {
    return this.inventoryService.startCount(id);
  }

  @Post("counts/:id/lines")
  @ApiOperation({ summary: "Registrar línea de conteo" })
  async registerCountLine(
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.registerCountLine(
      id,
      payload as unknown as { id_producto: string; cantidad_contada: number },
      user,
    );
  }

  @Post("counts/:id/close")
  @ApiOperation({ summary: "Cerrar conteo y generar ajuste" })
  async closeCount(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.closeCount(id, user);
  }

  @Post("adjustments")
  @ApiOperation({ summary: "Crear ajuste de inventario" })
  async createAdjustment(
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.createAdjustment(
      payload as unknown as {
        tipo_ajuste: string;
        id_bodega: string;
        motivo: string;
        detalles: Array<{ id_producto: string; cantidad_ajuste: number }>;
      },
      user,
    );
  }

  @Post("adjustments/:id/approve")
  @ApiOperation({ summary: "Aprobar ajuste de inventario" })
  async approveAdjustment(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.approveAdjustment(id, user);
  }

  @Post("adjustments/:id/apply")
  @ApiOperation({ summary: "Aplicar ajuste de inventario" })
  async applyAdjustment(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.applyAdjustment(id, user);
  }

  @Post("blocks")
  @ApiOperation({ summary: "Bloquear inventario no vendible" })
  async block(@Body() payload: FlexibleDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.blockInventory(
      payload as unknown as {
        id_producto: string;
        id_bodega: string;
        tipo_bloqueo: string;
        cantidad_bloqueada: number;
        motivo: string;
      },
      user,
    );
  }

  @Post("blocks/:id/release")
  @ApiOperation({ summary: "Liberar bloqueo de inventario" })
  async releaseBlock(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.releaseBlock(id, user);
  }

  @Get(":entity")
  @ApiOperation({ summary: "Listar entidades estructurales de inventario" })
  async listEntity(
    @Param("entity") entity: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.inventoryService.listEntity(entity, query);
  }

  @Get(":entity/:id")
  @ApiOperation({ summary: "Consultar entidad estructural de inventario" })
  async getEntity(@Param("entity") entity: string, @Param("id") id: string) {
    return this.inventoryService.getEntity(entity, id);
  }

  @Post(":entity")
  @ApiOperation({ summary: "Crear entidad estructural de inventario" })
  async createEntity(
    @Param("entity") entity: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.createEntity(entity, payload, user);
  }

  @Patch(":entity/:id")
  @ApiOperation({ summary: "Actualizar entidad estructural de inventario" })
  async updateEntity(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.updateEntity(entity, id, payload, user);
  }
}

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
