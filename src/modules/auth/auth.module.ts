import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { CurrentUser, type AuthUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DatabaseModule } from "../../database/database.module";
import { DatabaseService } from "../../database/database.service";
import { AuditModule, AuditService } from "../audit/audit.module";

class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

class RegisterDto {
  @IsString()
  @MinLength(2)
  nombres!: string;

  @IsString()
  @MinLength(2)
  apellidos!: string;

  @IsEmail()
  correo_electronico!: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  numero_documento?: string;

  @IsString()
  @MinLength(3)
  nombre_usuario!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class RecoverPasswordRequestDto {
  @IsString()
  identifier!: string;
}

class RecoverPasswordConfirmDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  new_password!: string;
}

class ChangePasswordDto {
  @IsString()
  current_password!: string;

  @IsString()
  @MinLength(8)
  new_password!: string;
}

type RequestMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(input: LoginDto, requestMeta: RequestMeta) {
    const jwtSecret = this.configService.getOrThrow<string>("jwtSecret");
    const jwtExpiresIn = this.configService.get<string>("jwtExpiresIn") ?? "8h";
    const identifier = input.username.trim();
    const result = await this.db.query<{
      id_usuario: string;
      correo_electronico: string;
      nombre_usuario: string;
      hash_contrasena: string;
      activo: boolean;
      bloqueado: boolean;
      intentos_fallidos: number;
    }>(
      `
      SELECT id_usuario, correo_electronico, nombre_usuario, hash_contrasena,
             activo, bloqueado, intentos_fallidos
      FROM seguridad.usuarios
      WHERE lower(nombre_usuario) = lower($1) OR lower(correo_electronico) = lower($1)
      LIMIT 1
      `,
      [identifier],
    );

    const user = result.rows[0];
    if (!user || !user.activo || user.bloqueado) {
      throw new UnauthorizedException("Usuario invalido o bloqueado");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.hash_contrasena);

    if (!passwordMatches) {
      await this.db.query(
        `
        UPDATE seguridad.usuarios
        SET intentos_fallidos = intentos_fallidos + 1,
            bloqueado = CASE WHEN intentos_fallidos + 1 >= 5 THEN true ELSE bloqueado END
        WHERE id_usuario = $1
        `,
        [user.id_usuario],
      );
      throw new UnauthorizedException("Credenciales invalidas");
    }

    await this.db.query(
      `
      UPDATE seguridad.usuarios
      SET intentos_fallidos = 0,
          fecha_ultimo_ingreso = now()
      WHERE id_usuario = $1
      `,
      [user.id_usuario],
    );

    const authContext = await this.getAuthContext(user.id_usuario);
    const token = jwt.sign(authContext, jwtSecret, {
      expiresIn: jwtExpiresIn as jwt.SignOptions["expiresIn"],
    });

    await this.db.query(
      `
      INSERT INTO seguridad.sesiones_usuario (
        id_usuario, token_sesion, direccion_ip, agente_usuario, fecha_expiracion
      )
      VALUES ($1, $2, $3, $4, now() + interval '8 hours')
      `,
      [user.id_usuario, token, requestMeta.ip ?? null, requestMeta.userAgent ?? null],
    );

    await this.auditService.logEvent({
      modulo: "auth",
      nombreTabla: "seguridad.usuarios",
      idRegistro: user.id_usuario,
      tipoEvento: "LOGIN",
      descripcion: "Inicio de sesion exitoso",
      idUsuario: user.id_usuario,
      direccionIp: requestMeta.ip ?? null,
      agenteUsuario: requestMeta.userAgent ?? null,
    });

    return {
      access_token: token,
      user: authContext,
    };
  }

  async register(input: RegisterDto, requestMeta: RequestMeta) {
    const nombres = input.nombres.trim();
    const apellidos = input.apellidos.trim();
    const correoElectronico = input.correo_electronico.trim().toLowerCase();
    const telefono = input.telefono?.trim() || null;
    const numeroDocumento = input.numero_documento?.trim() || null;
    const nombreUsuario = input.nombre_usuario.trim().toLowerCase();
    const password = input.password.trim();

    if (!nombres || !apellidos || !correoElectronico || !nombreUsuario) {
      throw new BadRequestException("Debes completar los campos obligatorios");
    }

    if (password.length < 8) {
      throw new BadRequestException("La contrasena debe tener al menos 8 caracteres");
    }

    const duplicatedUser = await this.db.query<{
      correo_electronico: string;
      nombre_usuario: string;
    }>(
      `
      SELECT correo_electronico, nombre_usuario
      FROM seguridad.usuarios
      WHERE lower(correo_electronico) = lower($1)
         OR lower(nombre_usuario) = lower($2)
      LIMIT 1
      `,
      [correoElectronico, nombreUsuario],
    );

    if (duplicatedUser.rows.length) {
      const existing = duplicatedUser.rows[0];
      if (existing.correo_electronico.toLowerCase() === correoElectronico) {
        throw new ConflictException("Ya existe una cuenta con ese correo");
      }

      throw new ConflictException("Ese nombre de usuario ya esta en uso");
    }

    if (numeroDocumento) {
      const duplicatedDocument = await this.db.query(
        `
        SELECT 1
        FROM maestros.terceros
        WHERE tipo_tercero = 'CLIENTE'
          AND numero_documento = $1
        LIMIT 1
        `,
        [numeroDocumento],
      );

      if (duplicatedDocument.rows.length) {
        throw new ConflictException("Ese numero de documento ya esta registrado");
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const customerDocument = numeroDocumento ?? `WEB-${nombreUsuario}`;

    const createdUser = await this.db.withTransaction(async (client) => {
      const userResult = await client.query<{
        id_usuario: string;
        correo_electronico: string;
        nombre_usuario: string;
      }>(
        `
        INSERT INTO seguridad.usuarios (
          numero_documento, nombres, apellidos, correo_electronico, telefono,
          nombre_usuario, hash_contrasena, requiere_cambio_clave, activo, bloqueado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, true, false)
        RETURNING id_usuario, correo_electronico, nombre_usuario
        `,
        [
          numeroDocumento,
          nombres,
          apellidos,
          correoElectronico,
          telefono,
          nombreUsuario,
          passwordHash,
        ],
      );

      const thirdPartyResult = await client.query<{ id_tercero: string }>(
        `
        INSERT INTO maestros.terceros (
          tipo_tercero, tipo_persona, numero_documento, nombres, apellidos,
          correo_electronico, telefono_principal, responsable_contacto, activo
        )
        VALUES ('CLIENTE', 'NATURAL', $1, $2, $3, $4, $5, $6, true)
        RETURNING id_tercero
        `,
        [
          customerDocument,
          nombres,
          apellidos,
          correoElectronico,
          telefono,
          `${nombres} ${apellidos}`.trim(),
        ],
      );

      await client.query(
        `
        INSERT INTO ventas.clientes (
          id_tercero, canal_registro, acepta_marketing, validado_mayor_edad, activo
        )
        VALUES ($1, 'ECOMMERCE', false, false, true)
        `,
        [thirdPartyResult.rows[0]?.id_tercero],
      );

      return userResult.rows[0];
    });

    await this.auditService.logEvent({
      modulo: "auth",
      nombreTabla: "seguridad.usuarios",
      idRegistro: createdUser.id_usuario,
      tipoEvento: "INSERT",
      descripcion: "Registro publico de usuario",
      idUsuario: createdUser.id_usuario,
      direccionIp: requestMeta.ip ?? null,
      agenteUsuario: requestMeta.userAgent ?? null,
      valorNuevo: {
        correo_electronico: createdUser.correo_electronico,
        nombre_usuario: createdUser.nombre_usuario,
      },
    });

    return this.login(
      {
        username: nombreUsuario,
        password,
      },
      requestMeta,
    );
  }

  async logout(token: string, user: AuthUser, requestMeta: RequestMeta) {
    await this.db.query(
      `
      UPDATE seguridad.sesiones_usuario
      SET activa = false,
          fecha_cierre = now()
      WHERE token_sesion = $1
      `,
      [token],
    );

    await this.auditService.logEvent({
      modulo: "auth",
      nombreTabla: "seguridad.sesiones_usuario",
      tipoEvento: "LOGOUT",
      descripcion: "Cierre de sesion",
      idUsuario: user.id_usuario,
      direccionIp: requestMeta.ip ?? null,
      agenteUsuario: requestMeta.userAgent ?? null,
    });

    return { message: "Sesion finalizada" };
  }

  async me(user: AuthUser) {
    return this.getAuthContext(user.id_usuario);
  }

  async requestPasswordRecovery(input: RecoverPasswordRequestDto) {
    const jwtSecret = this.configService.getOrThrow<string>("jwtSecret");
    const identifier = input.identifier.trim();
    const result = await this.db.query<{ id_usuario: string; correo_electronico: string }>(
      `
      SELECT id_usuario, correo_electronico
      FROM seguridad.usuarios
      WHERE lower(correo_electronico) = lower($1) OR lower(nombre_usuario) = lower($1)
      LIMIT 1
      `,
      [identifier],
    );

    if (!result.rows.length) {
      return { message: "Si el usuario existe, el token fue generado" };
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id_usuario: user.id_usuario, purpose: "password-recovery" },
      jwtSecret,
      { expiresIn: "30m" as jwt.SignOptions["expiresIn"] },
    );

    return {
      message: "Token de recuperacion generado",
      recovery_token: token,
      email: user.correo_electronico,
    };
  }

  async confirmPasswordRecovery(input: RecoverPasswordConfirmDto) {
    let payload: { id_usuario: string; purpose: string };
    try {
      payload = jwt.verify(
        input.token,
        this.configService.getOrThrow<string>("jwtSecret"),
      ) as { id_usuario: string; purpose: string };
    } catch {
      throw new UnauthorizedException("Token de recuperacion invalido");
    }

    if (payload.purpose !== "password-recovery") {
      throw new UnauthorizedException("Token de recuperacion invalido");
    }

    const hash = await bcrypt.hash(input.new_password, 10);
    await this.db.query(
      `
      UPDATE seguridad.usuarios
      SET hash_contrasena = $1,
          requiere_cambio_clave = false,
          bloqueado = false,
          intentos_fallidos = 0
      WHERE id_usuario = $2
      `,
      [hash, payload.id_usuario],
    );

    return { message: "Contrasena actualizada" };
  }

  async changePassword(user: AuthUser, input: ChangePasswordDto) {
    const result = await this.db.query<{ hash_contrasena: string }>(
      "SELECT hash_contrasena FROM seguridad.usuarios WHERE id_usuario = $1",
      [user.id_usuario],
    );

    const matches = await bcrypt.compare(
      input.current_password,
      result.rows[0]?.hash_contrasena ?? "",
    );

    if (!matches) {
      throw new UnauthorizedException("La contrasena actual no coincide");
    }

    const hash = await bcrypt.hash(input.new_password, 10);
    await this.db.query(
      `
      UPDATE seguridad.usuarios
      SET hash_contrasena = $1,
          requiere_cambio_clave = false
      WHERE id_usuario = $2
      `,
      [hash, user.id_usuario],
    );

    return { message: "Contrasena actualizada" };
  }

  private async getAuthContext(idUsuario: string): Promise<AuthUser> {
    const userResult = await this.db.query<{
      id_usuario: string;
      correo_electronico: string;
      nombre_usuario: string;
    }>(
      `
      SELECT id_usuario, correo_electronico, nombre_usuario
      FROM seguridad.usuarios
      WHERE id_usuario = $1
      `,
      [idUsuario],
    );

    const rolesResult = await this.db.query<{ codigo: string }>(
      `
      SELECT DISTINCT r.codigo
      FROM seguridad.usuarios_roles ur
      JOIN seguridad.roles r ON r.id_rol = ur.id_rol
      WHERE ur.id_usuario = $1
        AND ur.activo = true
        AND ur.fecha_revocacion IS NULL
      `,
      [idUsuario],
    );

    const permissionsResult = await this.db.query<{ codigo: string }>(
      `
      SELECT DISTINCT p.codigo
      FROM seguridad.usuarios_roles ur
      JOIN seguridad.roles_permisos rp ON rp.id_rol = ur.id_rol
      JOIN seguridad.permisos p ON p.id_permiso = rp.id_permiso
      WHERE ur.id_usuario = $1
        AND ur.activo = true
        AND ur.fecha_revocacion IS NULL
      `,
      [idUsuario],
    );

    return {
      ...userResult.rows[0],
      roles: rolesResult.rows.map((item: { codigo: string }) => item.codigo),
      permissions: permissionsResult.rows.map((item: { codigo: string }) => item.codigo),
    };
  }
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Registrar cuenta publica" })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: { ip?: string; headers: Record<string, string> },
  ) {
    return this.authService.register(dto, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("login")
  @ApiOperation({ summary: "Iniciar sesion" })
  async login(
    @Body() dto: LoginDto,
    @Req() request: { ip?: string; headers: Record<string, string> },
  ) {
    return this.authService.login(dto, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("password/recover-request")
  @ApiOperation({ summary: "Solicitar recuperacion de contrasena" })
  async recoverRequest(@Body() dto: RecoverPasswordRequestDto) {
    return this.authService.requestPasswordRecovery(dto);
  }

  @Post("password/recover-confirm")
  @ApiOperation({ summary: "Confirmar recuperacion de contrasena" })
  async recoverConfirm(@Body() dto: RecoverPasswordConfirmDto) {
    return this.authService.confirmPasswordRecovery(dto);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Consultar usuario autenticado" })
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  @Post("password/change")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Cambiar contrasena" })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user, dto);
  }

  @Post("logout")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Cerrar sesion" })
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() request: { ip?: string; headers: Record<string, string> },
  ) {
    const authorization = request.headers.authorization ?? "";
    return this.authService.logout(authorization.replace("Bearer ", "").trim(), user, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }
}

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
