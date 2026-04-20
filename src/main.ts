import "reflect-metadata";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import { AppModule } from "./app.module";
import { PostgresExceptionFilter } from "./common/filters/postgres-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const uploadsRoot = join(process.cwd(), "uploads");
  mkdirSync(uploadsRoot, { recursive: true });

  await app.register(helmet);
  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 6 * 1024 * 1024,
    },
  });
  await app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: "/uploads/",
  });

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new PostgresExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle("Arle Inventory API")
    .setDescription("Backend de inventario, compras, ventas, cumplimiento y auditoría")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
