import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";
import { AuthUser } from "../current-user.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token no proporcionado");
    }

    const token = authorization.replace("Bearer ", "").trim();
    try {
      const payload = jwt.verify(
        token,
        this.configService.getOrThrow<string>("jwtSecret"),
      ) as AuthUser;
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido o expirado");
    }
  }
}
