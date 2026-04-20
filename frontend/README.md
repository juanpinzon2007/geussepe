# Arle Frontend Angular

Frontend empresarial en Angular 20 para operar el backend monolítico de Arle sobre inventario, compras, ventas, cumplimiento, auditoría, analítica, reportes, IA e integraciones.

## Stack

- Angular 20 standalone
- TypeScript estricto
- Angular Material + CDK
- RxJS
- SCSS con design tokens
- Nginx para despliegue productivo
- Docker multistage

## Arquitectura

El frontend quedó organizado por capas y dominios:

```text
src/app/
  core/
    config/        navegación y registro declarativo de entidades
    guards/        auth, guest, permission
    interceptors/  auth, loading, error
    models/        contratos y tipos compartidos
    services/      API, auth, sesión, breadcrumbs, feedback
  shared/
    layout/        shell principal con sidebar, topbar y breadcrumbs
    ui/            page header, stat cards, dialogs reutilizables
  features/
    auth/
    dashboard/
    entity/
    inventory/
    purchases/
    sales/
    compliance/
    audit/
    analytics/
    reports/
    ai/
    integrations/
    profile/
    errors/
```

## Decisiones de arquitectura

- `standalone components` para reducir fricción y facilitar lazy loading.
- `AppShell` único para todo el backoffice.
- `SessionStore` con `signals` para sesión y permisos.
- `HttpClient` con interceptores para token, loader global y manejo centralizado de errores.
- `ENTITY_REGISTRY` para CRUD declarativo por dominio y entidad.
- Pantallas transaccionales separadas para operaciones de negocio que no encajan en CRUD genérico.
- `sessionStorage` para disminuir persistencia del token en navegador; el backend actual usa bearer token.

## Módulos funcionales implementados

- `Auth`: login y recuperación.
- `Dashboard`: KPIs operativos y rutas rápidas.
- `Entity Management`: CRUD reusable para entidades maestras y administrativas.
- `Inventory Operations`: stock, documentos manuales, reservas y traslados.
- `Purchases Operations`: órdenes y recepciones.
- `Sales Operations`: pedidos comerciales y ecommerce.
- `Compliance`: consentimientos y habeas data.
- `Audit`: eventos y respuestas de aprobación.
- `Analytics`: dashboard y rotación.
- `Reports`: ejecución de reportes por endpoint.
- `AI`: forecast y extracción documental.
- `Integrations`: consulta de sistemas y sincronizaciones.
- `Profile`: contexto de sesión y cambio de contraseña.

## Entidades cubiertas en el CRUD declarativo

- Seguridad: `users`, `roles`, `permissions`
- Maestros: `categories`, `brands`, `products`, `third-parties`
- Inventario: `branches`, `warehouses`, `locations`, `lots`
- Compras: `payment-terms`
- Ventas: `clients`, `payment-methods`
- Cumplimiento: `privacy-policies`
- Auditoría: `approval-flows`
- Integraciones: `systems`

El patrón soporta crecer agregando nuevas entidades en [`entity.registry.ts`](./src/app/core/config/entity.registry.ts).

## Seguridad frontend

- Guard de autenticación para todo `/app`.
- Guard de invitado para evitar volver al login con sesión activa.
- Guard por permisos con fallback para rol `ADMINISTRADOR`.
- Interceptor bearer token.
- Logout forzado en `401`.
- Validaciones reactivas antes de disparar requests.

## UX y diseño

- Layout corporativo con navegación lateral y breadcrumbs.
- Diseño responsive para desktop, tablet y móvil.
- Estados de carga globales por interceptor.
- Feedback transaccional con snackbars.
- Formularios reactivos y desacoplados.
- Diseño visual con tokens SCSS, tipografías dedicadas y superficies elevadas.

## Ambientes

Archivos disponibles:

- `src/environments/environment.development.ts`
- `src/environments/environment.qa.ts`
- `src/environments/environment.prod.ts`

URLs por defecto:

- Desarrollo: `http://localhost:3000/api/v1`
- Producción Docker: `/api/v1` vía proxy Nginx

## Scripts

```bash
npm install
npm run start
npm run start:host
npm run build
npm run build:qa
npm run build:prod
```

## Docker

Levantamiento integral desde la raíz del monolito:

```bash
docker compose up --build
```

Servicios:

- Frontend Angular/Nginx: `http://localhost:4200`
- API NestJS: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

## Checklist profesional

- Arquitectura modular por dominios
- Lazy loading
- Guards e interceptors
- Tipado fuerte
- Formularios reactivos
- Diseño responsive
- Shell reusable
- CRUD declarativo y extensible
- Conexión real al backend
- Dockerización productiva
- Preparado para QA y producción

## Recomendaciones para seguir creciendo

- Agregar tests unitarios con `ng test` por feature.
- Incorporar `angular-eslint` y formateo automatizado en CI.
- Mover `sessionStorage` a cookies `httpOnly` cuando el backend soporte sesión por cookie.
- Ampliar el registro declarativo con más entidades y selects remotos.
- Agregar tablas con paginación servidor/cliente y filtros avanzados por columna.
