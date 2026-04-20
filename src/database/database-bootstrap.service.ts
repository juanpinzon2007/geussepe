import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { DatabaseService } from "./database.service";
import {
  STOREFRONT_PRICE_START,
  STOREFRONT_PRODUCT_IMAGE_BY_SKU,
  STOREFRONT_SEED_CATEGORIES,
} from "../modules/storefront/storefront-catalog.seed";

interface SeedRole {
  codigo: string;
  nombre: string;
  descripcion: string;
}

interface SeedPermission {
  modulo: string;
  codigo: string;
  nombre: string;
  accion: string;
}

const DEFAULT_ROLES: SeedRole[] = [
  {
    codigo: "ADMINISTRADOR",
    nombre: "Administrador",
    descripcion: "Acceso total al sistema",
  },
  {
    codigo: "JEFE_BODEGA",
    nombre: "Jefe de bodega",
    descripcion: "Supervisión de inventario y operaciones de bodega",
  },
  {
    codigo: "AUXILIAR",
    nombre: "Auxiliar",
    descripcion: "Operación asistida de inventario y conteos",
  },
  {
    codigo: "COMPRAS",
    nombre: "Compras",
    descripcion: "Gestión de proveedores y compras",
  },
  {
    codigo: "VENTAS",
    nombre: "Ventas",
    descripcion: "Gestión comercial y POS",
  },
  {
    codigo: "AUDITOR",
    nombre: "Auditor",
    descripcion: "Auditoría, reportes y trazabilidad",
  },
  {
    codigo: "CALIDAD",
    nombre: "Calidad",
    descripcion: "Gestión regulatoria, cuarentenas y bloqueos",
  },
  {
    codigo: "GERENCIA",
    nombre: "Gerencia",
    descripcion: "Indicadores, IA y aprobaciones",
  },
];

const DEFAULT_PERMISSIONS: SeedPermission[] = [
  { modulo: "auth", codigo: "auth.manage", nombre: "Gestionar autenticación", accion: "MANAGE" },
  { modulo: "security", codigo: "security.manage", nombre: "Gestionar seguridad", accion: "MANAGE" },
  { modulo: "masters", codigo: "masters.manage", nombre: "Gestionar maestros", accion: "MANAGE" },
  { modulo: "inventory", codigo: "inventory.manage", nombre: "Gestionar inventario", accion: "MANAGE" },
  { modulo: "purchases", codigo: "purchases.manage", nombre: "Gestionar compras", accion: "MANAGE" },
  { modulo: "sales", codigo: "sales.manage", nombre: "Gestionar ventas", accion: "MANAGE" },
  { modulo: "compliance", codigo: "compliance.manage", nombre: "Gestionar cumplimiento", accion: "MANAGE" },
  { modulo: "audit", codigo: "audit.read", nombre: "Consultar auditoría", accion: "READ" },
  { modulo: "reports", codigo: "reports.read", nombre: "Consultar reportes", accion: "READ" },
  { modulo: "ai", codigo: "ai.manage", nombre: "Gestionar IA", accion: "MANAGE" },
];

const DEFAULT_MOVEMENT_TYPES = [
  ["ENTRADA_MANUAL", "Entrada manual", "ENTRADA", true, true],
  ["SALIDA_MANUAL", "Salida manual", "SALIDA", true, true],
  ["RECEPCION_COMPRA", "Recepción de compra", "ENTRADA", true, false],
  ["VENTA", "Venta", "SALIDA", true, false],
  ["TRASLADO_SALIDA", "Traslado salida", "TRASLADO", false, false],
  ["TRASLADO_ENTRADA", "Traslado entrada", "TRASLADO", false, false],
  ["TRANSFERENCIA_INTERNA_SALIDA", "Transferencia interna salida", "TRASLADO", false, false],
  ["TRANSFERENCIA_INTERNA_ENTRADA", "Transferencia interna entrada", "TRASLADO", false, false],
  ["AJUSTE_POSITIVO", "Ajuste positivo", "AJUSTE", true, true],
  ["AJUSTE_NEGATIVO", "Ajuste negativo", "AJUSTE", true, true],
  ["RESERVA", "Reserva", "RESERVA", false, false],
  ["LIBERACION_RESERVA", "Liberación reserva", "LIBERACION", false, false],
  ["BLOQUEO", "Bloqueo de inventario", "BLOQUEO", false, true],
  ["DESBLOQUEO", "Desbloqueo de inventario", "DESBLOQUEO", false, true],
  ["DEVOLUCION_PROVEEDOR", "Devolución a proveedor", "SALIDA", true, true],
  ["DEVOLUCION_CLIENTE", "Devolución de cliente", "ENTRADA", true, true],
] as const;

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
    await this.seedSecurity();
    await this.seedMovementTypes();
    await this.seedStorefrontCatalog();
  }

  private async ensureSchema(): Promise<void> {
    const result = await this.db.query<{ exists: string | null }>(
      "SELECT to_regclass('seguridad.usuarios') AS exists",
    );

    if (result.rows[0]?.exists) {
      return;
    }

    const sqlPath = join(process.cwd(), "base.sql");
    const script = readFileSync(sqlPath, "utf8");
    await this.db.query(script);
    this.logger.log("Esquema base inicializado desde base.sql");
  }

  private async seedSecurity(): Promise<void> {
    for (const role of DEFAULT_ROLES) {
      await this.db.query(
        `
        INSERT INTO seguridad.roles (codigo, nombre, descripcion, es_rol_sistema)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (codigo) DO UPDATE
          SET nombre = EXCLUDED.nombre,
              descripcion = EXCLUDED.descripcion
        `,
        [role.codigo, role.nombre, role.descripcion],
      );
    }

    for (const permission of DEFAULT_PERMISSIONS) {
      await this.db.query(
        `
        INSERT INTO seguridad.permisos (modulo, codigo, nombre, accion)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (codigo) DO UPDATE
          SET nombre = EXCLUDED.nombre,
              accion = EXCLUDED.accion,
              modulo = EXCLUDED.modulo
        `,
        [
          permission.modulo,
          permission.codigo,
          permission.nombre,
          permission.accion,
        ],
      );
    }

    const adminRole = await this.db.query<{ id_rol: string }>(
      "SELECT id_rol FROM seguridad.roles WHERE codigo = 'ADMINISTRADOR'",
    );
    const allPermissions = await this.db.query<{ id_permiso: string }>(
      "SELECT id_permiso FROM seguridad.permisos",
    );

    for (const permission of allPermissions.rows) {
      await this.db.query(
        `
        INSERT INTO seguridad.roles_permisos (id_rol, id_permiso)
        VALUES ($1, $2)
        ON CONFLICT (id_rol, id_permiso) DO NOTHING
        `,
        [adminRole.rows[0]?.id_rol, permission.id_permiso],
      );
    }

    const password = bcrypt.hashSync(
      this.configService.get<string>("defaultAdminPassword") ?? "Admin123*",
      10,
    );

    await this.db.query(
      `
      INSERT INTO seguridad.usuarios (
        numero_documento, nombres, apellidos, correo_electronico, telefono,
        nombre_usuario, hash_contrasena, requiere_cambio_clave, activo, bloqueado
      )
      VALUES (
        '900000001', 'Admin', 'Arle', 'admin@arle.local', '3000000000',
        'admin', $1, false, true, false
      )
      ON CONFLICT (correo_electronico) DO NOTHING
      `,
      [password],
    );

    await this.db.query(
      `
      INSERT INTO seguridad.usuarios_roles (id_usuario, id_rol, activo)
      SELECT u.id_usuario, r.id_rol, true
      FROM seguridad.usuarios u
      CROSS JOIN seguridad.roles r
      WHERE u.nombre_usuario = 'admin'
        AND r.codigo = 'ADMINISTRADOR'
        AND NOT EXISTS (
          SELECT 1
          FROM seguridad.usuarios_roles ur
          WHERE ur.id_usuario = u.id_usuario
            AND ur.id_rol = r.id_rol
            AND ur.activo = true
        )
      `,
    );
  }

  private async seedMovementTypes(): Promise<void> {
    for (const movementType of DEFAULT_MOVEMENT_TYPES) {
      await this.db.query(
        `
        INSERT INTO inventario.tipos_movimiento_inventario (
          codigo, nombre, naturaleza, afecta_costo, requiere_aprobacion
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (codigo) DO UPDATE
          SET nombre = EXCLUDED.nombre,
              naturaleza = EXCLUDED.naturaleza,
              afecta_costo = EXCLUDED.afecta_costo,
              requiere_aprobacion = EXCLUDED.requiere_aprobacion
        `,
        [...movementType],
      );
    }
  }

  private async seedStorefrontCatalog(): Promise<void> {
    const unit = await this.db.query<{ id_unidad_medida: string }>(
      `
      INSERT INTO maestros.unidades_medida (codigo, nombre, descripcion, activo)
      VALUES ('UND', 'Unidad', 'Unidad comercial base', true)
      ON CONFLICT (codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            descripcion = EXCLUDED.descripcion,
            activo = true
      RETURNING id_unidad_medida
      `,
    );

    const currency = await this.db.query<{ id_moneda: string }>(
      `
      INSERT INTO maestros.monedas (codigo, nombre, simbolo, activo)
      VALUES ('COP', 'Peso colombiano', '$', true)
      ON CONFLICT (codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            simbolo = EXCLUDED.simbolo,
            activo = true
      RETURNING id_moneda
      `,
    );

    const salesChannel = await this.db.query<{ id_canal_venta: string }>(
      `
      INSERT INTO maestros.canales_venta (codigo, nombre, tipo_canal, activo)
      VALUES ('ECOMMERCE', 'Tienda online', 'ECOMMERCE', true)
      ON CONFLICT (codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            tipo_canal = EXCLUDED.tipo_canal,
            activo = true
      RETURNING id_canal_venta
      `,
    );

    const priceList = await this.db.query<{ id_lista_precio: string }>(
      `
      INSERT INTO maestros.listas_precios (
        codigo, nombre, id_moneda, id_canal_venta, descripcion,
        fecha_inicio_vigencia, activa
      )
      VALUES ($1, $2, $3, $4, $5, $6::date, true)
      ON CONFLICT (codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            id_moneda = EXCLUDED.id_moneda,
            id_canal_venta = EXCLUDED.id_canal_venta,
            descripcion = EXCLUDED.descripcion,
            fecha_inicio_vigencia = EXCLUDED.fecha_inicio_vigencia,
            activa = true
      RETURNING id_lista_precio
      `,
      [
        "LISTA-ECOMMERCE",
        "Lista ecommerce El Desquite",
        currency.rows[0]?.id_moneda,
        salesChannel.rows[0]?.id_canal_venta,
        "Lista publica del catalogo erotico online",
        STOREFRONT_PRICE_START,
      ],
    );

    const unitId = unit.rows[0]?.id_unidad_medida;
    const priceListId = priceList.rows[0]?.id_lista_precio;

    for (const category of STOREFRONT_SEED_CATEGORIES) {
      const categoryResult = await this.db.query<{ id_categoria_producto: string }>(
        `
        INSERT INTO maestros.categorias_producto (
          codigo, nombre, descripcion, nivel, permite_venta_menores, activo
        )
        VALUES ($1, $2, $3, 1, false, true)
        ON CONFLICT (codigo) DO UPDATE
          SET nombre = EXCLUDED.nombre,
              descripcion = EXCLUDED.descripcion,
              nivel = 1,
              permite_venta_menores = false,
              activo = true
        RETURNING id_categoria_producto
        `,
        [category.code, category.name, category.description],
      );

      const categoryId = categoryResult.rows[0]?.id_categoria_producto;

      for (const [index, item] of category.items.entries()) {
        const sku = this.buildSku(category.code, index);
        const productImageUrl = STOREFRONT_PRODUCT_IMAGE_BY_SKU[sku] ?? category.imageUrl;
        const price = category.basePrice + category.priceStep * index;
        const isKit = item.toLowerCase().includes("kit");
        const productResult = await this.db.query<{ id_producto: string }>(
          `
          INSERT INTO maestros.productos (
            sku, nombre, nombre_corto, descripcion, id_categoria_producto,
            id_unidad_medida_base, tipo_producto, subtipo_producto,
            es_inventariable, maneja_lotes, maneja_vencimiento,
            requiere_registro_sanitario, requiere_control_mayoria_edad,
            es_restringido, es_kit, temperatura_minima, temperatura_maxima,
            url_imagen_principal, activo, observaciones
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            true, $9, $10, $11, true, true, $12, $13, $14, $15, true, $16
          )
          ON CONFLICT (sku) DO UPDATE
            SET nombre = EXCLUDED.nombre,
                nombre_corto = EXCLUDED.nombre_corto,
                descripcion = EXCLUDED.descripcion,
                id_categoria_producto = EXCLUDED.id_categoria_producto,
                id_unidad_medida_base = EXCLUDED.id_unidad_medida_base,
                tipo_producto = EXCLUDED.tipo_producto,
                subtipo_producto = EXCLUDED.subtipo_producto,
                maneja_lotes = EXCLUDED.maneja_lotes,
                maneja_vencimiento = EXCLUDED.maneja_vencimiento,
                requiere_registro_sanitario = EXCLUDED.requiere_registro_sanitario,
                requiere_control_mayoria_edad = true,
                es_restringido = true,
                es_kit = EXCLUDED.es_kit,
                temperatura_minima = EXCLUDED.temperatura_minima,
                temperatura_maxima = EXCLUDED.temperatura_maxima,
                url_imagen_principal = EXCLUDED.url_imagen_principal,
                activo = true,
                observaciones = EXCLUDED.observaciones
          RETURNING id_producto
          `,
          [
            sku,
            item,
            item,
            this.buildProductDescription(item, category.name, category.description),
            categoryId,
            unitId,
            category.type,
            item,
            category.handlesLots,
            category.handlesExpiry,
            category.requiresSanitary,
            isKit,
            category.storageMin ?? null,
            category.storageMax ?? null,
            productImageUrl,
            "Catalogo curado para la tienda sensual ecommerce",
          ],
        );

        await this.db.query(
          `
          INSERT INTO maestros.precios_producto (
            id_producto, id_lista_precio, precio_base, costo_referencia,
            margen_objetivo_pct, precio_minimo, precio_maximo, incluye_impuestos,
            fecha_inicio_vigencia, activo
          )
          VALUES ($1, $2, $3, $4, 45, $5, $6, true, $7::date, true)
          ON CONFLICT (id_producto, id_lista_precio, fecha_inicio_vigencia) DO UPDATE
            SET precio_base = EXCLUDED.precio_base,
                costo_referencia = EXCLUDED.costo_referencia,
                precio_minimo = EXCLUDED.precio_minimo,
                precio_maximo = EXCLUDED.precio_maximo,
                incluye_impuestos = true,
                activo = true
          `,
          [
            productResult.rows[0]?.id_producto,
            priceListId,
            price,
            Math.round(price * 0.55),
            Math.round(price * 0.88),
            Math.round(price * 1.18),
            STOREFRONT_PRICE_START,
          ],
        );
      }
    }

    this.logger.log(
      `Catalogo storefront asegurado con ${STOREFRONT_SEED_CATEGORIES.length} categorias eroticas`,
    );
  }

  private buildSku(categoryCode: string, index: number) {
    return `${categoryCode.replace(/[^A-Z0-9]/g, "").slice(0, 12)}-${String(index + 1).padStart(3, "0")}`;
  }

  private buildProductDescription(item: string, categoryName: string, categoryDescription: string) {
    return `${item} dentro de ${categoryName.toLowerCase()}. ${categoryDescription}`;
  }
}
