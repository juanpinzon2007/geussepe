import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { DatabaseService } from "./database.service";

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
}
