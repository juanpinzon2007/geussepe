import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

type PgLikeError = Error & {
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
};

@Catch()
export class PostgresExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PostgresExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<{ url?: string; method?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).send(body);
      return;
    }

    const error = exception as PgLikeError;
    if (typeof error?.code === "string") {
      const mapped = this.mapDatabaseError(error);
      response.status(mapped.statusCode).send({
        statusCode: mapped.statusCode,
        error: mapped.error,
        message: mapped.message,
        code: error.code,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
      message: "Internal server error",
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapDatabaseError(error: PgLikeError) {
    const context = [error.table, error.column, error.constraint].filter(Boolean).join(".");
    const detail = error.detail ?? "La operación no cumple las reglas de la base de datos";
    const suffix = context ? ` (${context})` : "";

    switch (error.code) {
      case "23502":
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: "Bad Request",
          message: `Falta un dato obligatorio${suffix}: ${detail}`,
        };
      case "23503":
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: "Bad Request",
          message: `La referencia enviada no existe o no es válida${suffix}: ${detail}`,
        };
      case "23505":
        return {
          statusCode: HttpStatus.CONFLICT,
          error: "Conflict",
          message: `Ya existe un registro con el mismo valor único${suffix}: ${detail}`,
        };
      case "23514":
      case "22P02":
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: "Bad Request",
          message: `Los datos enviados no cumplen una validación${suffix}: ${detail}`,
        };
      default:
        this.logger.error(error);
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
          message: "Internal server error",
        };
    }
  }
}
