import { Controller, Get, Module } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { DatabaseModule } from "../../database/database.module";
import { DatabaseService } from "../../database/database.service";

@ApiTags("Health")
@Controller("health")
class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @ApiOperation({ summary: "Verificar salud de la API y la base de datos" })
  async health() {
    const dbResult = await this.db.query("SELECT now() AS database_time");
    return {
      status: "ok",
      database: dbResult.rows[0],
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
