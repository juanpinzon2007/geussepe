import { BadRequestException, Body, Controller, Get, Injectable, Module, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { DatabaseModule } from "../../database/database.module";
import { DatabaseService } from "../../database/database.service";
import { SalesModule, SalesService } from "../sales/sales.module";
import { STOREFRONT_PRODUCT_IMAGE_BY_SKU, STOREFRONT_SEED_CATEGORIES } from "./storefront-catalog.seed";

type StorefrontProductRow = {
  id_producto: string;
  sku: string;
  nombre: string;
  nombre_corto: string | null;
  descripcion: string | null;
  categoria_id: string | null;
  categoria_nombre: string | null;
  tipo_producto: string;
  url_imagen_principal: string | null;
  precio: string | number | null;
  stock_disponible: string | number | null;
};

type StorefrontCollectionRow = {
  id_categoria_producto: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  total_productos: string | number;
  lead_product_id: string | null;
  lead_product_name: string | null;
  lead_product_image: string | null;
};

const STOREFRONT_CATEGORY_CODES = STOREFRONT_SEED_CATEGORIES.map((category) => category.code);
const CATEGORY_ORDER_SQL = STOREFRONT_SEED_CATEGORIES.map(
  (category, index) => `WHEN '${category.code}' THEN ${index}`,
).join("\n            ");
const CATEGORY_IMAGE_BY_NAME = new Map(
  STOREFRONT_SEED_CATEGORIES.map((category) => [category.name, category.imageUrl]),
);
const CATEGORY_IMAGE_BY_CODE = new Map(
  STOREFRONT_SEED_CATEGORIES.map((category) => [category.code, category.imageUrl]),
);

class StorefrontOrderDto {
  nombre_cliente?: string;
  correo_cliente?: string;
  telefono_cliente?: string;
  ciudad_cliente?: string;
  observaciones?: string;
  referencia_externa?: string;
  costo_envio?: number;
  detalles!: Array<{
    id_producto: string;
    cantidad: number;
    precio_unitario: number;
    porcentaje_descuento?: number;
    porcentaje_impuesto?: number;
  }>;
}

@Injectable()
export class StorefrontService {
  constructor(
    private readonly db: DatabaseService,
    private readonly salesService: SalesService,
  ) {}

  async getHome() {
    const [productsResult, collectionsResult] = await Promise.all([
      this.db.query<StorefrontProductRow>(
        `
        WITH stock AS (
          SELECT id_producto, SUM(cantidad_disponible) AS stock_disponible
          FROM inventario.v_stock_actual
          GROUP BY id_producto
        )
        SELECT
          p.id_producto,
          p.sku,
          p.nombre,
          p.nombre_corto,
          p.descripcion,
          p.id_categoria_producto AS categoria_id,
          c.nombre AS categoria_nombre,
          p.tipo_producto,
          p.url_imagen_principal,
          latest_price.precio_base AS precio,
          COALESCE(stock.stock_disponible, 0) AS stock_disponible
        FROM maestros.productos p
        LEFT JOIN maestros.categorias_producto c
          ON c.id_categoria_producto = p.id_categoria_producto
        LEFT JOIN LATERAL (
          SELECT pp.precio_base
          FROM maestros.precios_producto pp
          WHERE pp.id_producto = p.id_producto
            AND pp.activo = true
            AND (pp.fecha_fin_vigencia IS NULL OR pp.fecha_fin_vigencia >= current_date)
          ORDER BY pp.fecha_inicio_vigencia DESC, pp.fecha_creacion DESC
          LIMIT 1
        ) latest_price ON true
        LEFT JOIN stock
          ON stock.id_producto = p.id_producto
        WHERE p.activo = true
          AND c.codigo = ANY($1::text[])
        ORDER BY
          CASE c.codigo
            ${CATEGORY_ORDER_SQL}
            ELSE ${STOREFRONT_SEED_CATEGORIES.length}
          END,
          p.sku ASC,
          p.nombre ASC
        `,
        [STOREFRONT_CATEGORY_CODES],
      ),
      this.db.query<StorefrontCollectionRow>(
        `
        SELECT
          c.id_categoria_producto,
          c.codigo,
          c.nombre,
          c.descripcion,
          COUNT(p.id_producto) AS total_productos,
          lead.id_producto AS lead_product_id,
          lead.nombre AS lead_product_name,
          lead.url_imagen_principal AS lead_product_image
        FROM maestros.categorias_producto c
        LEFT JOIN maestros.productos p
          ON p.id_categoria_producto = c.id_categoria_producto
          AND p.activo = true
        LEFT JOIN LATERAL (
          SELECT p2.id_producto, COALESCE(p2.nombre_corto, p2.nombre) AS nombre, p2.url_imagen_principal
          FROM maestros.productos p2
          WHERE p2.id_categoria_producto = c.id_categoria_producto
            AND p2.activo = true
          ORDER BY p2.sku ASC, p2.nombre ASC
          LIMIT 1
        ) lead ON true
        WHERE c.activo = true
          AND c.codigo = ANY($1::text[])
        GROUP BY
          c.id_categoria_producto,
          c.codigo,
          c.nombre,
          c.descripcion,
          lead.id_producto,
          lead.nombre,
          lead.url_imagen_principal
        HAVING COUNT(p.id_producto) > 0
        ORDER BY
          CASE c.codigo
            ${CATEGORY_ORDER_SQL}
            ELSE ${STOREFRONT_SEED_CATEGORIES.length}
          END,
          c.nombre ASC
        `,
        [STOREFRONT_CATEGORY_CODES],
      ),
    ]);

    const products = productsResult.rows.map((row) => this.mapProduct(row));
    const heroProducts = products.slice(0, 4);

    return {
      brand: {
        name: "El Desquite",
        subtitle: "Sex shop premium y discreto",
      },
      hero: {
        title: "Deseo sin filtro",
        subtitle:
          "Explora lenceria, juguetes, lubricantes, BDSM, smart toys y rituales eroticos con una vitrina intensa, clara y lista para comprar.",
        button_text: "Agregar favoritos",
        products: heroProducts,
      },
      collections: collectionsResult.rows.map((row, index) => ({
        ...(row.codigo === "PRESERVATIVOS-PROTECCION"
          ? {
              image_url: CATEGORY_IMAGE_BY_CODE.get(row.codigo) ?? row.lead_product_image ?? null,
            }
          : {
              image_url: row.lead_product_image ?? CATEGORY_IMAGE_BY_CODE.get(row.codigo) ?? null,
            }),
        id: row.id_categoria_producto,
        title: row.nombre,
        subtitle: row.descripcion ?? "Seleccion destacada para tu vitrina.",
        total_products: Number(row.total_productos ?? 0),
        lead_product_id: row.lead_product_id,
        lead_product_name: row.lead_product_name,
        tone: this.getCollectionTone(index),
      })),
      products,
      promo: {
        label: "Comunidad Webcam",
        helper: "Convenio especial con Stripchat",
        description:
          "Tenemos un convenio de trafico y visibilidad con Stripchat para conectar a nuestra comunidad con shows en vivo, promociones cruzadas y beneficios exclusivos desde El Desquite.",
        url: "https://es.stripchat.com/",
      },
      support: {
        help_text: "Candela resuelve dudas de juguetes, lubricantes, lenceria y pedidos discretos.",
        whatsapp_url:
          process.env.STOREFRONT_WHATSAPP_URL ??
          "https://wa.me/573102423080?text=Hola,%20quiero%20ayuda%20con%20mi%20pedido",
      },
    };
  }

  async createOrder(input: StorefrontOrderDto) {
    if (!input.detalles?.length) {
      throw new BadRequestException("Debes enviar al menos un producto.");
    }

    const observaciones = JSON.stringify({
      cliente: {
        nombre: input.nombre_cliente ?? null,
        correo: input.correo_cliente ?? null,
        telefono: input.telefono_cliente ?? null,
        ciudad: input.ciudad_cliente ?? null,
      },
      notas: input.observaciones ?? null,
    });

    return this.salesService.createEcommerceOrder({
      costo_envio: input.costo_envio ?? 0,
      referencia_externa: input.referencia_externa ?? input.correo_cliente ?? undefined,
      observaciones,
      detalles: input.detalles,
    });
  }

  private mapProduct(row: StorefrontProductRow) {
    const imageUrl =
      STOREFRONT_PRODUCT_IMAGE_BY_SKU[row.sku] ??
      row.url_imagen_principal ??
      this.resolveFallbackImage(row);
    return {
      id: row.id_producto,
      title: row.nombre_corto ?? row.nombre,
      full_name: row.nombre,
      description: row.descripcion ?? "Seleccion destacada del catalogo.",
      category_id: row.categoria_id,
      category_name: row.categoria_nombre ?? "Coleccion",
      product_type: row.tipo_producto,
      image_url: imageUrl,
      price: Number(row.precio ?? this.resolveFallbackPrice(row)),
      stock_available: Number(row.stock_disponible ?? 0),
    };
  }

  private getCollectionTone(index: number) {
    const tones = ["rose", "mint", "lavender", "pearl"];
    return tones[index % tones.length];
  }

  private resolveFallbackImage(row: StorefrontProductRow) {
    if (row.categoria_nombre && CATEGORY_IMAGE_BY_NAME.has(row.categoria_nombre)) {
      return CATEGORY_IMAGE_BY_NAME.get(row.categoria_nombre)!;
    }

    const normalized = `${row.nombre} ${row.tipo_producto}`.toLowerCase();
    const matchingCategory = STOREFRONT_SEED_CATEGORIES.find((category) =>
      normalized.includes(category.name.split(" ")[0].toLowerCase()),
    );

    return matchingCategory?.imageUrl ?? STOREFRONT_SEED_CATEGORIES[0].imageUrl;
  }

  private resolveFallbackPrice(row: StorefrontProductRow) {
    const normalized = `${row.nombre} ${row.tipo_producto}`.toLowerCase();
    if (normalized.includes("conejo")) {
      return 139900;
    }
    if (normalized.includes("kit")) {
      return 169900;
    }
    if (normalized.includes("lub")) {
      return 49900;
    }
    if (normalized.includes("lencer")) {
      return 89900;
    }
    if (normalized.includes("plug")) {
      return 69900;
    }

    return 59900;
  }
}

@ApiTags("Storefront")
@Controller("storefront")
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get("home")
  @ApiOperation({ summary: "Consultar contenido publico de la home ecommerce" })
  async home() {
    return this.storefrontService.getHome();
  }

  @Post("orders")
  @ApiOperation({ summary: "Crear un pedido ecommerce desde la vitrina publica" })
  async createOrder(@Body() payload: StorefrontOrderDto) {
    return this.storefrontService.createOrder(payload);
  }
}

@Module({
  imports: [DatabaseModule, SalesModule],
  controllers: [StorefrontController],
  providers: [StorefrontService],
})
export class StorefrontModule {}
