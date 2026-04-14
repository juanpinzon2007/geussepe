import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  id_usuario: string;
  correo_electronico: string;
  nombre_usuario: string;
  roles: string[];
  permissions: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
