import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import appConfig from "./config/app.config";
import { DatabaseModule } from "./database/database.module";
import { AiModule } from "./modules/ai/ai.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { HealthModule } from "./modules/health/health.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { MastersModule } from "./modules/masters/masters.module";
import { PurchasesModule } from "./modules/purchases/purchases.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SalesModule } from "./modules/sales/sales.module";
import { SecurityModule } from "./modules/security/security.module";
import { StorefrontModule } from "./modules/storefront/storefront.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    DatabaseModule,
    HealthModule,
    AuditModule,
    AuthModule,
    SecurityModule,
    MastersModule,
    InventoryModule,
    PurchasesModule,
    SalesModule,
    ComplianceModule,
    AnalyticsModule,
    ReportsModule,
    AiModule,
    IntegrationsModule,
    StorefrontModule,
  ],
})
export class AppModule {}
