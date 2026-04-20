import {
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
import bcrypt from "bcryptjs";
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
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

const SECURITY_ENTITY_CONFIGS: Record<string, EntityConfig> = {
  users: {
    route: "users",
    table: "seguridad.usuarios",
    idColumn: "id_usuario",
    defaultOrderBy: "nombre_usuario",
    allowedColumns: [
      "id_tipo_documento_identidad",
      "numero_documento",
      "nombres",
      "apellidos",
      "correo_electronico",
      "telefono",
      "nombre_usuario",
      "hash_contrasena",
      "requiere_cambio_clave",
      "activo",
      "bloqueado",
      "url_firma_digital",
    ],
    filterColumns: ["activo", "bloqueado", "nombre_usuario", "correo_electronico"],
    searchableColumns: ["nombres", "apellidos", "correo_electronico", "nombre_usuario", "numero_documento"],
  },
  roles: {
    route: "roles",
    table: "seguridad.roles",
    idColumn: "id_rol",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "descripcion", "es_rol_sistema", "activo"],
    filterColumns: ["activo", "codigo"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  permissions: {
    route: "permissions",
    table: "seguridad.permisos",
    idColumn: "id_permiso",
    defaultOrderBy: "codigo",
    allowedColumns: ["modulo", "codigo", "nombre", "descripcion", "accion", "activo"],
    filterColumns: ["modulo", "accion", "activo"],
    searchableColumns: ["codigo", "nombre", "descripcion", "modulo"],
  },
};

class CreateUserDto {
  @IsOptional()
  @IsUUID()
  id_tipo_documento_identidad?: string;

  @IsOptional()
  @IsString()
  numero_documento?: string;

  @IsString()
  nombres!: string;

  @IsString()
  apellidos!: string;

  @IsEmail()
  correo_electronico!: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsString()
  nombre_usuario!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  requiere_cambio_clave?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

class UpdateEntityDto {
  [key: string]: unknown;
}

class AssignRolesDto {
  @IsArray()
  role_ids!: string[];
}

class AssignPermissionsDto {
  @IsArray()
  permission_ids!: string[];
}

@Injectable()
export class SecurityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async list(entity: string, query: Record<string, unknown>) {
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

  async get(entity: string, id: string) {
    const config = this.getConfig(entity);
    const result = await this.db.query(
      `SELECT * FROM ${config.table} WHERE ${config.idColumn} = $1`,
      [id],
    );
    return result.rows[0];
  }

  async createUser(input: CreateUserDto, actor?: AuthUser) {
    const hash = await bcrypt.hash(input.password, 10);
    const payload = {
      id_tipo_documento_identidad: input.id_tipo_documento_identidad,
      numero_documento: input.numero_documento,
      nombres: input.nombres,
      apellidos: input.apellidos,
      correo_electronico: input.correo_electronico,
      telefono: input.telefono,
      nombre_usuario: input.nombre_usuario,
      hash_contrasena: hash,
      requiere_cambio_clave: input.requiere_cambio_clave ?? true,
      activo: input.activo ?? true,
    };

    const query = buildInsertQuery("seguridad.usuarios", payload, "id_usuario");
    const result = await this.db.query<Record<string, unknown> & { id_usuario: string }>(
      query.text,
      query.values,
    );

    await this.auditService.logEvent({
      modulo: "security",
      nombreTabla: "seguridad.usuarios",
      idRegistro: result.rows[0].id_usuario,
      tipoEvento: "INSERT",
      descripcion: "Usuario creado",
      idUsuario: actor?.id_usuario ?? null,
      valorNuevo: result.rows[0],
    });

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
      modulo: "security",
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
    const before = await this.get(entity, id);
    const data = pickAllowedValues(payload, config.allowedColumns);
    const query = buildUpdateQuery(config.table, data, config.idColumn, id);
    const result = await this.db.query(query.text, query.values);

    await this.auditService.logEvent({
      modulo: "security",
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

  async assignRoles(userId: string, roleIds: string[], actor?: AuthUser) {
    await this.db.withTransaction(async (client) => {
      await client.query(
        "UPDATE seguridad.usuarios_roles SET activo = false, fecha_revocacion = now() WHERE id_usuario = $1",
        [userId],
      );

      for (const roleId of roleIds) {
        await client.query(
          `
          INSERT INTO seguridad.usuarios_roles (id_usuario, id_rol, activo)
          VALUES ($1, $2, true)
          `,
          [userId, roleId],
        );
      }
    });

    await this.auditService.logEvent({
      modulo: "security",
      nombreTabla: "seguridad.usuarios_roles",
      idRegistro: userId,
      tipoEvento: "UPDATE",
      descripcion: "Asignación de roles de usuario",
      idUsuario: actor?.id_usuario ?? null,
      valorNuevo: { role_ids: roleIds },
    });

    return this.getUserSecurityProfile(userId);
  }

  async assignPermissions(roleId: string, permissionIds: string[], actor?: AuthUser) {
    await this.db.withTransaction(async (client) => {
      await client.query("DELETE FROM seguridad.roles_permisos WHERE id_rol = $1", [roleId]);
      for (const permissionId of permissionIds) {
        await client.query(
          `
          INSERT INTO seguridad.roles_permisos (id_rol, id_permiso)
          VALUES ($1, $2)
          `,
          [roleId, permissionId],
        );
      }
    });

    await this.auditService.logEvent({
      modulo: "security",
      nombreTabla: "seguridad.roles_permisos",
      idRegistro: roleId,
      tipoEvento: "UPDATE",
      descripcion: "Asignación de permisos al rol",
      idUsuario: actor?.id_usuario ?? null,
      valorNuevo: { permission_ids: permissionIds },
    });

    return this.getRoleSecurityProfile(roleId);
  }

  async getUserSecurityProfile(userId: string) {
    const user = await this.get("users", userId);
    const roles = await this.db.query(
      `
      SELECT ur.id_usuario_rol, ur.activo, ur.fecha_asignacion, ur.fecha_revocacion,
             r.id_rol, r.codigo, r.nombre
      FROM seguridad.usuarios_roles ur
      JOIN seguridad.roles r ON r.id_rol = ur.id_rol
      WHERE ur.id_usuario = $1
      ORDER BY ur.fecha_asignacion DESC
      `,
      [userId],
    );
    return { ...user, roles: roles.rows };
  }

  async getRoleSecurityProfile(roleId: string) {
    const role = await this.get("roles", roleId);
    const permissions = await this.db.query(
      `
      SELECT rp.id_rol_permiso, p.id_permiso, p.codigo, p.nombre, p.modulo, p.accion
      FROM seguridad.roles_permisos rp
      JOIN seguridad.permisos p ON p.id_permiso = rp.id_permiso
      WHERE rp.id_rol = $1
      ORDER BY p.codigo
      `,
      [roleId],
    );
    return { ...role, permissions: permissions.rows };
  }

  private getConfig(entity: string) {
    const config = SECURITY_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new Error(`Entidad de seguridad no soportada: ${entity}`);
    }
    return config;
  }
}

@ApiTags("Security")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("security.manage")
@Controller("security")
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get(":entity")
  @ApiOperation({ summary: "Listar usuarios, roles o permisos" })
  async list(
    @Param("entity") entity: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.securityService.list(entity, query);
  }

  @Get(":entity/:id")
  @ApiOperation({ summary: "Consultar un registro de seguridad" })
  async get(@Param("entity") entity: string, @Param("id") id: string) {
    return this.securityService.get(entity, id);
  }

  @Post("users")
  @ApiOperation({ summary: "Crear usuario" })
  async createUser(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.securityService.createUser(dto, user);
  }

  @Post(":entity")
  @ApiOperation({ summary: "Crear rol o permiso" })
  async createEntity(
    @Param("entity") entity: string,
    @Body() payload: UpdateEntityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.securityService.createEntity(entity, payload, user);
  }

  @Patch(":entity/:id")
  @ApiOperation({ summary: "Actualizar un registro de seguridad" })
  async updateEntity(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Body() payload: UpdateEntityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.securityService.updateEntity(entity, id, payload, user);
  }

  @Post("users/:id/roles")
  @ApiOperation({ summary: "Asignar roles a un usuario" })
  async assignRoles(
    @Param("id") id: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.securityService.assignRoles(id, dto.role_ids, user);
  }

  @Post("roles/:id/permissions")
  @ApiOperation({ summary: "Asignar permisos a un rol" })
  async assignPermissions(
    @Param("id") id: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.securityService.assignPermissions(id, dto.permission_ids, user);
  }

  @Get("users/:id/profile")
  @ApiOperation({ summary: "Consultar perfil de seguridad de usuario" })
  async getUserProfile(@Param("id") id: string) {
    return this.securityService.getUserSecurityProfile(id);
  }

  @Get("roles/:id/profile")
  @ApiOperation({ summary: "Consultar perfil de seguridad de rol" })
  async getRoleProfile(@Param("id") id: string) {
    return this.securityService.getRoleSecurityProfile(id);
  }
}

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
