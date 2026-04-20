export default () => ({
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/inventario_sexshop",
  jwtSecret: process.env.JWT_SECRET ?? "super-secret-inventory-key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin123*",
  appName: "arle-inventory-api",
});
