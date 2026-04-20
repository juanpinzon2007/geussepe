# Arle Inventory Backend

Backend monolítico en TypeScript sobre NestJS 11 + Fastify + PostgreSQL para inventario, compras, ventas, cumplimiento, auditoría, analítica, reportes, integraciones e IA.

## Stack

- NestJS 11
- Fastify
- PostgreSQL 16
- JWT
- `pg` como acceso a datos
- Docker / Docker Compose
- Swagger en `/docs`

## Arquitectura

El proyecto quedó como monolito modular. Los módulos implementados son:

- `auth`
- `security`
- `masters`
- `inventory`
- `purchases`
- `sales`
- `compliance`
- `audit`
- `analytics`
- `reports`
- `ai`
- `integrations`

La base se inicializa desde [`base.sql`](/C:/Users/MI%20PC/Desktop/proyecto%20arle/base.sql) si el esquema no existe. Además se crea un usuario administrador por defecto.

## Arranque

1. Copiar variables desde `.env.example` si se desea correr fuera de Docker.
2. Levantar con Docker:

```bash
docker compose up --build
```

3. Entradas útiles:

- Frontend Angular: `http://localhost:4200`
- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: [`postman/arle-openapi.json`](/C:/Users/MI%20PC/Desktop/proyecto%20arle/postman/arle-openapi.json)
- Arquitectura frontend: [`frontend/README.md`](/C:/Users/MI%20PC/Desktop/proyecto%20arle/frontend/README.md)

## Credenciales por defecto

- Usuario: `admin`
- Clave: `Admin123*`

## Endpoints

### Health

- `GET /health`

### Auth

- `POST /auth/login`
- `POST /auth/password/recover-request`
- `POST /auth/password/recover-confirm`
- `GET /auth/me`
- `POST /auth/password/change`
- `POST /auth/logout`

### Security

- `GET /security/:entity`
- `GET /security/:entity/:id`
- `POST /security/users`
- `POST /security/:entity`
- `PATCH /security/:entity/:id`
- `POST /security/users/:id/roles`
- `POST /security/roles/:id/permissions`
- `GET /security/users/:id/profile`
- `GET /security/roles/:id/profile`

Entidades soportadas:

- `roles`
- `permissions`

### Masters

- `GET /masters/catalog`
- `GET /masters/providers`
- `GET /masters/products/:id/full`
- `GET /masters/:entity`
- `GET /masters/:entity/:id`
- `POST /masters/:entity`
- `PATCH /masters/:entity/:id`

Entidades soportadas:

- `countries`
- `departments`
- `cities`
- `units`
- `currencies`
- `document-types`
- `tax-types`
- `tax-rates`
- `general-states`
- `third-parties`
- `third-party-addresses`
- `third-party-bank-accounts`
- `third-party-documents`
- `categories`
- `brands`
- `product-tags`
- `products`
- `product-tag-links`
- `product-packages`
- `product-components`
- `product-taxes`
- `product-documents`
- `sanitary-records`
- `sales-channels`
- `price-lists`
- `product-prices`

### Inventory

- `GET /inventory/catalog`
- `GET /inventory/stock`
- `GET /inventory/kardex`
- `POST /inventory/manual-documents`
- `POST /inventory/documents/:id/apply`
- `POST /inventory/reservations`
- `POST /inventory/reservations/release-expired`
- `POST /inventory/reservations/:id/release`
- `POST /inventory/reservations/:id/consume`
- `POST /inventory/transfers`
- `POST /inventory/transfers/:id/approve`
- `POST /inventory/transfers/:id/dispatch`
- `POST /inventory/transfers/:id/receive`
- `POST /inventory/internal-transfers`
- `POST /inventory/internal-transfers/:id/apply`
- `POST /inventory/counts`
- `POST /inventory/counts/:id/start`
- `POST /inventory/counts/:id/lines`
- `POST /inventory/counts/:id/close`
- `POST /inventory/adjustments`
- `POST /inventory/adjustments/:id/approve`
- `POST /inventory/adjustments/:id/apply`
- `POST /inventory/blocks`
- `POST /inventory/blocks/:id/release`
- `GET /inventory/:entity`
- `GET /inventory/:entity/:id`
- `POST /inventory/:entity`
- `PATCH /inventory/:entity/:id`

Entidades soportadas:

- `branches`
- `warehouses`
- `warehouse-zones`
- `locations`
- `lots`
- `movement-types`

### Purchases

- `GET /purchases/:entity`
- `GET /purchases/:entity/:id`
- `POST /purchases/:entity`
- `PATCH /purchases/:entity/:id`
- `POST /purchases/orders`
- `POST /purchases/orders/:id/approve`
- `POST /purchases/orders/:id/cancel`
- `POST /purchases/receptions`
- `POST /purchases/receptions/:id/validate`
- `POST /purchases/receptions/:id/apply`
- `POST /purchases/supplier-returns`
- `POST /purchases/supplier-returns/:id/approve`
- `POST /purchases/supplier-returns/:id/dispatch`

Entidades soportadas:

- `payment-terms`
- `invoices`

### Sales

- `GET /sales/:entity`
- `GET /sales/:entity/:id`
- `POST /sales/:entity`
- `PATCH /sales/:entity/:id`
- `POST /sales/orders`
- `POST /sales/orders/:id/confirm`
- `POST /sales/orders/:id/payments`
- `POST /sales/orders/:id/invoice`
- `POST /sales/orders/:id/cancel`
- `POST /sales/ecommerce-orders`
- `POST /sales/ecommerce-orders/:id/reserve`
- `POST /sales/ecommerce-orders/:id/dispatch`
- `POST /sales/ecommerce-orders/:id/deliver`
- `POST /sales/returns`
- `POST /sales/returns/:id/resolve`

Entidades soportadas:

- `clients`
- `client-addresses`
- `payment-methods`
- `cash-registers`
- `invoices`

### Compliance

- `GET /compliance/:entity`
- `GET /compliance/:entity/:id`
- `POST /compliance/:entity`
- `PATCH /compliance/:entity/:id`
- `POST /compliance/consents/:id/revoke`
- `POST /compliance/habeas-requests/:id/respond`
- `POST /compliance/regulatory-alerts/:id/close`

Entidades soportadas:

- `privacy-policies`
- `consents`
- `habeas-requests`
- `age-validations`
- `regulatory-alerts`

### Audit

- `GET /audit/events`
- `POST /audit/events`
- `GET /audit/:entity`
- `GET /audit/:entity/:id`
- `POST /audit/:entity`
- `PATCH /audit/:entity/:id`
- `POST /audit/approval-requests/:id/respond`
- `POST /audit/operational-alerts/:id/attend`

Entidades soportadas:

- `approval-flows`
- `approval-levels`
- `approval-requests`
- `approval-responses`
- `operational-alerts`

### Analytics

- `GET /analytics/dashboard`
- `GET /analytics/rotation`
- `GET /analytics/stock-alerts`

### Reports

- `GET /reports/inventory`
- `GET /reports/expirations`
- `GET /reports/traceability`
- `GET /reports/purchases`
- `GET /reports/sales`
- `GET /reports/audit`

### AI

- `GET /ai/:entity`
- `POST /ai/forecast-demand`
- `POST /ai/replenishment`
- `POST /ai/detect-anomalies`
- `POST /ai/classify-product/:id`
- `POST /ai/extract-document`

Entidades soportadas:

- `models`
- `forecasts`
- `replenishments`
- `anomalies`
- `classifications`
- `extractions`

### Integrations

- `GET /integrations/:entity`
- `GET /integrations/:entity/:id`
- `POST /integrations/:entity`
- `PATCH /integrations/:entity/:id`

Entidades soportadas:

- `systems`
- `syncs`

## Postman

Archivos listos para importar:

- OpenAPI completo: [`postman/arle-openapi.json`](/C:/Users/MI%20PC/Desktop/proyecto%20arle/postman/arle-openapi.json)
- Colección smoke/E2E: [`postman/arle-smoke.postman_collection.json`](/C:/Users/MI%20PC/Desktop/proyecto%20arle/postman/arle-smoke.postman_collection.json)
- Environment local: [`postman/arle-local.postman_environment.json`](/C:/Users/MI%20PC/Desktop/proyecto%20arle/postman/arle-local.postman_environment.json)

Uso recomendado en Postman:

1. Importar el environment local.
2. Importar el OpenAPI si se quiere navegar todos los endpoints.
3. Importar la colección smoke para ejecutar una validación rápida end to end.

## Ajustes realizados

- Se corrigió el flujo de movimientos manuales para inferir la bodega en las líneas y evitar errores al registrar inventario.
- Se corrigió la consulta de `analytics/stock-alerts`, que estaba leyendo columnas inexistentes.
- Se agregó manejo global de errores PostgreSQL para responder `4xx` claros en lugar de `500` genéricos cuando fallan restricciones de datos.
- El `Dockerfile` quedó en modo multistage con build de TypeScript y runtime en producción.
