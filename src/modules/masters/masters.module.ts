import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Permissions, PermissionsGuard } from "../../common/guards/permissions.guard";
import {
  EntityConfig,
  buildInsertQuery,
  buildListQuery,
  buildUpdateQuery,
  pickAllowedValues,
} from "../../common/sql.utils";
import { DatabaseModule } from "../../database/database.module";
import { DatabaseService } from "../../database/database.service";
import { AuditModule, AuditService } from "../audit/audit.module";

const MASTER_ENTITY_CONFIGS: Record<string, EntityConfig> = {
  countries: {
    route: "countries",
    table: "maestros.paises",
    idColumn: "id_pais",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo_iso2", "codigo_iso3", "nombre", "activo"],
    filterColumns: ["activo", "codigo_iso2"],
    searchableColumns: ["codigo_iso2", "codigo_iso3", "nombre"],
  },
  departments: {
    route: "departments",
    table: "maestros.departamentos",
    idColumn: "id_departamento",
    defaultOrderBy: "nombre",
    allowedColumns: ["id_pais", "codigo", "nombre", "activo"],
    filterColumns: ["id_pais", "activo"],
    searchableColumns: ["codigo", "nombre"],
  },
  cities: {
    route: "cities",
    table: "maestros.ciudades",
    idColumn: "id_ciudad",
    defaultOrderBy: "nombre",
    allowedColumns: ["id_departamento", "codigo", "nombre", "activo"],
    filterColumns: ["id_departamento", "activo"],
    searchableColumns: ["codigo", "nombre"],
  },
  units: {
    route: "units",
    table: "maestros.unidades_medida",
    idColumn: "id_unidad_medida",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "descripcion", "activo"],
    filterColumns: ["activo", "codigo"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  currencies: {
    route: "currencies",
    table: "maestros.monedas",
    idColumn: "id_moneda",
    defaultOrderBy: "codigo",
    allowedColumns: ["codigo", "nombre", "simbolo", "activo"],
    filterColumns: ["activo", "codigo"],
    searchableColumns: ["codigo", "nombre"],
  },
  "document-types": {
    route: "document-types",
    table: "maestros.tipos_documento_identidad",
    idColumn: "id_tipo_documento_identidad",
    defaultOrderBy: "codigo",
    allowedColumns: [
      "codigo",
      "nombre",
      "aplica_persona_natural",
      "aplica_persona_juridica",
      "activo",
    ],
    filterColumns: ["activo", "aplica_persona_natural", "aplica_persona_juridica"],
    searchableColumns: ["codigo", "nombre"],
  },
  "tax-types": {
    route: "tax-types",
    table: "maestros.tipos_impuesto",
    idColumn: "id_tipo_impuesto",
    defaultOrderBy: "codigo",
    allowedColumns: ["codigo", "nombre", "descripcion", "activo"],
    filterColumns: ["activo", "codigo"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  "tax-rates": {
    route: "tax-rates",
    table: "maestros.tasas_impuesto",
    idColumn: "id_tasa_impuesto",
    defaultOrderBy: "fecha_inicio_vigencia",
    allowedColumns: [
      "id_tipo_impuesto",
      "nombre",
      "porcentaje",
      "fecha_inicio_vigencia",
      "fecha_fin_vigencia",
      "activo",
    ],
    filterColumns: ["id_tipo_impuesto", "activo"],
    searchableColumns: ["nombre"],
  },
  "general-states": {
    route: "general-states",
    table: "maestros.estados_generales",
    idColumn: "id_estado_general",
    defaultOrderBy: "orden_visual",
    allowedColumns: [
      "modulo",
      "codigo",
      "nombre",
      "descripcion",
      "orden_visual",
      "activo",
    ],
    filterColumns: ["modulo", "activo"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  "third-parties": {
    route: "third-parties",
    table: "maestros.terceros",
    idColumn: "id_tercero",
    defaultOrderBy: "fecha_creacion",
    allowedColumns: [
      "tipo_tercero",
      "tipo_persona",
      "id_tipo_documento_identidad",
      "numero_documento",
      "digito_verificacion",
      "razon_social",
      "nombres",
      "apellidos",
      "nombre_comercial",
      "correo_electronico",
      "telefono_principal",
      "telefono_secundario",
      "sitio_web",
      "responsable_contacto",
      "regimen_tributario",
      "obligado_facturar",
      "gran_contribuyente",
      "autorretenedor",
      "agente_retencion",
      "activo",
      "observaciones",
    ],
    filterColumns: ["tipo_tercero", "tipo_persona", "activo", "obligado_facturar"],
    searchableColumns: ["numero_documento", "razon_social", "nombres", "apellidos", "nombre_comercial", "correo_electronico"],
  },
  "third-party-addresses": {
    route: "third-party-addresses",
    table: "maestros.direcciones_tercero",
    idColumn: "id_direccion_tercero",
    defaultOrderBy: "fecha_creacion",
    allowedColumns: [
      "id_tercero",
      "id_pais",
      "id_departamento",
      "id_ciudad",
      "direccion_linea_1",
      "direccion_linea_2",
      "codigo_postal",
      "es_principal",
      "tipo_direccion",
      "latitud",
      "longitud",
      "activo",
    ],
    filterColumns: ["id_tercero", "tipo_direccion", "activo", "es_principal"],
    searchableColumns: ["direccion_linea_1", "direccion_linea_2", "codigo_postal"],
  },
  "third-party-bank-accounts": {
    route: "third-party-bank-accounts",
    table: "maestros.cuentas_bancarias_tercero",
    idColumn: "id_cuenta_bancaria_tercero",
    defaultOrderBy: "fecha_creacion",
    allowedColumns: [
      "id_tercero",
      "banco",
      "tipo_cuenta",
      "numero_cuenta",
      "titular",
      "moneda",
      "es_principal",
      "activa",
    ],
    filterColumns: ["id_tercero", "tipo_cuenta", "activa", "es_principal"],
    searchableColumns: ["banco", "numero_cuenta", "titular"],
  },
  "third-party-documents": {
    route: "third-party-documents",
    table: "maestros.documentos_tercero",
    idColumn: "id_documento_tercero",
    defaultOrderBy: "fecha_vencimiento",
    allowedColumns: [
      "id_tercero",
      "tipo_documento",
      "nombre_documento",
      "numero_documento",
      "fecha_emision",
      "fecha_vencimiento",
      "url_archivo",
      "hash_archivo",
      "version",
      "vigente",
      "observaciones",
    ],
    filterColumns: ["id_tercero", "tipo_documento", "vigente"],
    searchableColumns: ["tipo_documento", "nombre_documento", "numero_documento"],
  },
  categories: {
    route: "categories",
    table: "maestros.categorias_producto",
    idColumn: "id_categoria_producto",
    defaultOrderBy: "nombre",
    allowedColumns: [
      "id_categoria_padre",
      "codigo",
      "nombre",
      "descripcion",
      "nivel",
      "permite_venta_menores",
      "activo",
    ],
    filterColumns: ["id_categoria_padre", "activo", "nivel"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  brands: {
    route: "brands",
    table: "maestros.marcas",
    idColumn: "id_marca",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "descripcion", "id_fabricante_tercero", "activa"],
    filterColumns: ["activa", "id_fabricante_tercero"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  "product-tags": {
    route: "product-tags",
    table: "maestros.etiquetas_producto",
    idColumn: "id_etiqueta_producto",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "descripcion", "activa"],
    filterColumns: ["activa"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  products: {
    route: "products",
    table: "maestros.productos",
    idColumn: "id_producto",
    defaultOrderBy: "nombre",
    allowedColumns: [
      "sku",
      "codigo_barras",
      "nombre",
      "nombre_corto",
      "descripcion",
      "id_categoria_producto",
      "id_marca",
      "id_fabricante_tercero",
      "id_importador_tercero",
      "id_unidad_medida_base",
      "tipo_producto",
      "subtipo_producto",
      "es_inventariable",
      "maneja_lotes",
      "maneja_vencimiento",
      "requiere_registro_sanitario",
      "requiere_control_mayoria_edad",
      "es_restringido",
      "es_kit",
      "peso",
      "alto",
      "ancho",
      "largo",
      "volumen",
      "color",
      "material",
      "pais_origen_id",
      "vida_util_dias",
      "temperatura_minima",
      "temperatura_maxima",
      "stock_minimo",
      "stock_maximo",
      "punto_reorden",
      "dias_cobertura_objetivo",
      "url_imagen_principal",
      "activo",
      "observaciones",
    ],
    filterColumns: [
      "activo",
      "id_categoria_producto",
      "id_marca",
      "tipo_producto",
      "es_restringido",
      "requiere_registro_sanitario",
      "maneja_lotes",
    ],
    searchableColumns: ["sku", "codigo_barras", "nombre", "nombre_corto", "descripcion"],
  },
  "product-tag-links": {
    route: "product-tag-links",
    table: "maestros.productos_etiquetas",
    idColumn: "id_producto_etiqueta",
    defaultOrderBy: "fecha_creacion",
    allowedColumns: ["id_producto", "id_etiqueta_producto"],
    filterColumns: ["id_producto", "id_etiqueta_producto"],
    searchableColumns: [],
  },
  "product-packages": {
    route: "product-packages",
    table: "maestros.productos_embalajes",
    idColumn: "id_producto_embalaje",
    defaultOrderBy: "nombre",
    allowedColumns: [
      "id_producto",
      "nombre",
      "tipo_embalaje",
      "cantidad_unidades_base",
      "id_unidad_medida",
      "peso",
      "alto",
      "ancho",
      "largo",
      "codigo_barras",
      "es_venta",
      "es_compra",
      "es_logistico",
      "activo",
    ],
    filterColumns: ["id_producto", "tipo_embalaje", "activo", "es_venta", "es_compra"],
    searchableColumns: ["nombre", "codigo_barras"],
  },
  "product-components": {
    route: "product-components",
    table: "maestros.productos_componentes",
    idColumn: "id_producto_componente",
    defaultOrderBy: "fecha_creacion",
    allowedColumns: ["id_producto_padre", "id_producto_hijo", "cantidad", "obligatorio"],
    filterColumns: ["id_producto_padre", "id_producto_hijo", "obligatorio"],
    searchableColumns: [],
  },
  "product-taxes": {
    route: "product-taxes",
    table: "maestros.productos_impuestos",
    idColumn: "id_producto_impuesto",
    defaultOrderBy: "fecha_inicio_vigencia",
    allowedColumns: [
      "id_producto",
      "id_tasa_impuesto",
      "tipo_aplicacion",
      "fecha_inicio_vigencia",
      "fecha_fin_vigencia",
      "activo",
    ],
    filterColumns: ["id_producto", "id_tasa_impuesto", "tipo_aplicacion", "activo"],
    searchableColumns: [],
  },
  "product-documents": {
    route: "product-documents",
    table: "maestros.productos_documentos",
    idColumn: "id_producto_documento",
    defaultOrderBy: "fecha_vencimiento",
    allowedColumns: [
      "id_producto",
      "tipo_documento",
      "nombre_documento",
      "numero_documento",
      "fecha_emision",
      "fecha_vencimiento",
      "entidad_emisora",
      "url_archivo",
      "hash_archivo",
      "version",
      "vigente",
      "observaciones",
    ],
    filterColumns: ["id_producto", "tipo_documento", "vigente"],
    searchableColumns: ["tipo_documento", "nombre_documento", "numero_documento", "entidad_emisora"],
  },
  "sanitary-records": {
    route: "sanitary-records",
    table: "cumplimiento.registros_sanitarios_producto",
    idColumn: "id_registro_sanitario_producto",
    defaultOrderBy: "fecha_vencimiento",
    allowedColumns: [
      "id_producto",
      "entidad_reguladora",
      "tipo_registro",
      "numero_registro",
      "fecha_emision",
      "fecha_vencimiento",
      "estado_registro",
      "titular_registro",
      "url_soporte",
      "observaciones",
      "activo",
    ],
    filterColumns: ["id_producto", "estado_registro", "activo"],
    searchableColumns: ["entidad_reguladora", "tipo_registro", "numero_registro", "titular_registro"],
  },
  "sales-channels": {
    route: "sales-channels",
    table: "maestros.canales_venta",
    idColumn: "id_canal_venta",
    defaultOrderBy: "nombre",
    allowedColumns: ["codigo", "nombre", "tipo_canal", "activo"],
    filterColumns: ["tipo_canal", "activo"],
    searchableColumns: ["codigo", "nombre"],
  },
  "price-lists": {
    route: "price-lists",
    table: "maestros.listas_precios",
    idColumn: "id_lista_precio",
    defaultOrderBy: "fecha_inicio_vigencia",
    allowedColumns: [
      "codigo",
      "nombre",
      "id_moneda",
      "id_canal_venta",
      "descripcion",
      "fecha_inicio_vigencia",
      "fecha_fin_vigencia",
      "activa",
    ],
    filterColumns: ["id_moneda", "id_canal_venta", "activa"],
    searchableColumns: ["codigo", "nombre", "descripcion"],
  },
  "product-prices": {
    route: "product-prices",
    table: "maestros.precios_producto",
    idColumn: "id_precio_producto",
    defaultOrderBy: "fecha_inicio_vigencia",
    allowedColumns: [
      "id_producto",
      "id_lista_precio",
      "precio_base",
      "costo_referencia",
      "margen_objetivo_pct",
      "precio_minimo",
      "precio_maximo",
      "incluye_impuestos",
      "fecha_inicio_vigencia",
      "fecha_fin_vigencia",
      "activo",
      "creado_por",
    ],
    filterColumns: ["id_producto", "id_lista_precio", "activo"],
    searchableColumns: [],
  },
};

class FlexibleDto {
  [key: string]: unknown;
}

@Injectable()
export class MastersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  getCatalog() {
    return Object.keys(MASTER_ENTITY_CONFIGS);
  }

  async list(entity: string, query: Record<string, unknown>) {
    const config = this.getConfig(entity);
    const { page, limit, search, ...filters } = query;
    const sql = buildListQuery(config, {
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
      search: typeof search === "string" ? search : undefined,
      filters,
    });
    const result = await this.db.query(sql.text, sql.values);
    return result.rows;
  }

  async get(entity: string, id: string) {
    const config = this.getConfig(entity);
    const result = await this.db.query(
      `SELECT * FROM ${config.table} WHERE ${config.idColumn} = $1`,
      [id],
    );
    return result.rows[0];
  }

  async create(entity: string, payload: Record<string, unknown>, actor?: AuthUser) {
    const config = this.getConfig(entity);
    const data = pickAllowedValues(payload, config.allowedColumns);

    if (entity === "product-prices" && actor) {
      data.creado_por = actor.id_usuario;
    }

    const query = buildInsertQuery(config.table, data, config.idColumn);
    const result = await this.db.query(query.text, query.values);

    await this.auditService.logEvent({
      modulo: "masters",
      nombreTabla: config.table,
      idRegistro: result.rows[0][config.idColumn] as string,
      tipoEvento: "INSERT",
      descripcion: `Creación en ${config.route}`,
      idUsuario: actor?.id_usuario ?? null,
      valorNuevo: result.rows[0],
    });

    return result.rows[0];
  }

  async update(
    entity: string,
    id: string,
    payload: Record<string, unknown>,
    actor?: AuthUser,
  ) {
    const config = this.getConfig(entity);
    const before = await this.get(entity, id);
    const data = pickAllowedValues(payload, config.allowedColumns);
    const query = buildUpdateQuery(config.table, data, config.idColumn, id);
    const result = await this.db.query(query.text, query.values);

    await this.auditService.logEvent({
      modulo: "masters",
      nombreTabla: config.table,
      idRegistro: id,
      tipoEvento: "UPDATE",
      descripcion: `Actualización en ${config.route}`,
      idUsuario: actor?.id_usuario ?? null,
      valorAnterior: before,
      valorNuevo: result.rows[0],
    });

    return result.rows[0];
  }

  async getProviders(query: Record<string, unknown>) {
    return this.list("third-parties", { ...query, tipo_tercero: "PROVEEDOR" });
  }

  async getProductProfile(productId: string) {
    const product = await this.get("products", productId);
    const [tags, packages, taxes, documents, sanitaryRecords, prices] =
      await Promise.all([
        this.list("product-tag-links", { id_producto: productId, limit: 100 }),
        this.list("product-packages", { id_producto: productId, limit: 100 }),
        this.list("product-taxes", { id_producto: productId, limit: 100 }),
        this.list("product-documents", { id_producto: productId, limit: 100 }),
        this.list("sanitary-records", { id_producto: productId, limit: 100 }),
        this.list("product-prices", { id_producto: productId, limit: 100 }),
      ]);

    return {
      product,
      tags,
      packages,
      taxes,
      documents,
      sanitary_records: sanitaryRecords,
      prices,
    };
  }

  private getConfig(entity: string) {
    const config = MASTER_ENTITY_CONFIGS[entity];
    if (!config) {
      throw new Error(`Entidad maestra no soportada: ${entity}`);
    }
    return config;
  }
}

@ApiTags("Masters")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("masters.manage")
@Controller("masters")
export class MastersController {
  constructor(private readonly mastersService: MastersService) {}

  @Get("catalog")
  @ApiOperation({ summary: "Listar entidades maestras soportadas" })
  async catalog() {
    return this.mastersService.getCatalog();
  }

  @Get("providers")
  @ApiOperation({ summary: "Listar proveedores" })
  async providers(@Query() query: Record<string, unknown>) {
    return this.mastersService.getProviders(query);
  }

  @Get("products/:id/full")
  @ApiOperation({ summary: "Consultar perfil completo del producto" })
  async productProfile(@Param("id") id: string) {
    return this.mastersService.getProductProfile(id);
  }

  @Get(":entity")
  @ApiOperation({ summary: "Listar registros maestros" })
  async list(
    @Param("entity") entity: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.mastersService.list(entity, query);
  }

  @Get(":entity/:id")
  @ApiOperation({ summary: "Consultar registro maestro" })
  async get(@Param("entity") entity: string, @Param("id") id: string) {
    return this.mastersService.get(entity, id);
  }

  @Post(":entity")
  @ApiOperation({ summary: "Crear registro maestro" })
  async create(
    @Param("entity") entity: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.mastersService.create(entity, payload, user);
  }

  @Patch(":entity/:id")
  @ApiOperation({ summary: "Actualizar registro maestro" })
  async update(
    @Param("entity") entity: string,
    @Param("id") id: string,
    @Body() payload: FlexibleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.mastersService.update(entity, id, payload, user);
  }
}

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [MastersController],
  providers: [MastersService],
  exports: [MastersService],
})
export class MastersModule {}
