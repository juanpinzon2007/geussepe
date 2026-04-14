import {
  Body,
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
import { IsOptional, IsString, MinLength } from "class-validator";
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

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(input: LoginDto, requestMeta: { ip?: string; userAgent?: string }) {
    const jwtSecret = this.configService.getOrThrow<string>("jwtSecret");
    const jwtExpiresIn = this.configService.get<string>("jwtExpiresIn") ?? "8h";
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
      WHERE nombre_usuario = $1 OR correo_electronico = $1
      LIMIT 1
      `,
      [input.username],
    );

    const user = result.rows[0];
    if (!user || !user.activo || user.bloqueado) {
      throw new UnauthorizedException("Usuario inválido o bloqueado");
    }

    const passwordMatches = await bcrypt.compare(
      input.password,
      user.hash_contrasena,
    );

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
      throw new UnauthorizedException("Credenciales inválidas");
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
      descripcion: "Inicio de sesión exitoso",
      idUsuario: user.id_usuario,
      direccionIp: requestMeta.ip ?? null,
      agenteUsuario: requestMeta.userAgent ?? null,
    });

    return {
      access_token: token,
      user: authContext,
    };
  }

  async logout(
    token: string,
    user: AuthUser,
    requestMeta: { ip?: string; userAgent?: string },
  ) {
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
      descripcion: "Cierre de sesión",
      idUsuario: user.id_usuario,
      direccionIp: requestMeta.ip ?? null,
      agenteUsuario: requestMeta.userAgent ?? null,
    });

    return { message: "Sesión finalizada" };
  }

  async me(user: AuthUser) {
    return this.getAuthContext(user.id_usuario);
  }

  async requestPasswordRecovery(input: RecoverPasswordRequestDto) {
    const jwtSecret = this.configService.getOrThrow<string>("jwtSecret");
    const result = await this.db.query<{ id_usuario: string; correo_electronico: string }>(
      `
      SELECT id_usuario, correo_electronico
      FROM seguridad.usuarios
      WHERE correo_electronico = $1 OR nombre_usuario = $1
      LIMIT 1
      `,
      [input.identifier],
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
      message: "Token de recuperación generado",
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
      throw new UnauthorizedException("Token de recuperación inválido");
    }

    if (payload.purpose !== "password-recovery") {
      throw new UnauthorizedException("Token de recuperación inválido");
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

    return { message: "Contraseña actualizada" };
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
      throw new UnauthorizedException("La contraseña actual no coincide");
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

    return { message: "Contraseña actualizada" };
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
      permissions: permissionsResult.rows.map(
        (item: { codigo: string }) => item.codigo,
      ),
    };
  }
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Iniciar sesión" })
  async login(@Body() dto: LoginDto, @Req() request: { ip?: string; headers: Record<string, string> }) {
    return this.authService.login(dto, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("password/recover-request")
  @ApiOperation({ summary: "Solicitar recuperación de contraseña" })
  async recoverRequest(@Body() dto: RecoverPasswordRequestDto) {
    return this.authService.requestPasswordRecovery(dto);
  }

  @Post("password/recover-confirm")
  @ApiOperation({ summary: "Confirmar recuperación de contraseña" })
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
  @ApiOperation({ summary: "Cambiar contraseña" })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, dto);
  }

  @Post("logout")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Cerrar sesión" })
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() request: { ip?: string; headers: Record<string, string> },
  ) {
    const authorization = request.headers.authorization ?? "";
    return this.authService.logout(
      authorization.replace("Bearer ", "").trim(),
      user,
      {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      },
    );
  }
}

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
