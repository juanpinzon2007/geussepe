-- =========================================================
-- PROYECTO: Sistema empresarial de inventarios para sexshop
-- MOTOR: PostgreSQL 14+
-- AUTOR: ChatGPT
-- NOTAS:
-- 1. Campos en español.
-- 2. Diseñado para cubrir compras, inventario, bodegas,
--    ventas, cumplimiento, auditoría e IA.
-- 3. Usa esquemas para separar dominios.
-- =========================================================

BEGIN;

-- =========================================================
-- EXTENSIONES
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ESQUEMAS
-- =========================================================
CREATE SCHEMA IF NOT EXISTS seguridad;
CREATE SCHEMA IF NOT EXISTS maestros;
CREATE SCHEMA IF NOT EXISTS inventario;
CREATE SCHEMA IF NOT EXISTS compras;
CREATE SCHEMA IF NOT EXISTS ventas;
CREATE SCHEMA IF NOT EXISTS cumplimiento;
CREATE SCHEMA IF NOT EXISTS integraciones;
CREATE SCHEMA IF NOT EXISTS ia;
CREATE SCHEMA IF NOT EXISTS auditoria;

-- =========================================================
-- FUNCIONES GENERALES
-- =========================================================
CREATE OR REPLACE FUNCTION maestros.generar_uuid()
RETURNS uuid
LANGUAGE sql
AS $$
SELECT gen_random_uuid();
$$;

CREATE OR REPLACE FUNCTION maestros.asignar_fechas_actualizacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION inventario.validar_cantidad_positiva()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    valor numeric;
BEGIN
    valor := COALESCE(
        NULLIF(to_jsonb(NEW)->>'cantidad', '')::numeric,
        NULLIF(to_jsonb(NEW)->>'cantidad_solicitada', '')::numeric,
        NULLIF(to_jsonb(NEW)->>'cantidad_aprobada', '')::numeric,
        NULLIF(to_jsonb(NEW)->>'cantidad_despachada', '')::numeric,
        NULLIF(to_jsonb(NEW)->>'cantidad_recibida', '')::numeric,
        NULLIF(to_jsonb(NEW)->>'cantidad_aceptada', '')::numeric,
        NULLIF(to_jsonb(NEW)->>'cantidad_rechazada', '')::numeric,
        NULLIF(to_jsonb(NEW)->>'cantidad_contada', '')::numeric,
        NULLIF(to_jsonb(NEW)->>'cantidad_ajuste', '')::numeric
    );

    IF valor IS NOT NULL AND valor <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a cero';
END IF;
RETURN NEW;
END;
$$;

-- =========================================================
-- TABLAS BASE / CATÁLOGOS GENERALES
-- =========================================================
CREATE TABLE maestros.paises (
                                 id_pais               uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                 codigo_iso2           varchar(2) NOT NULL UNIQUE,
                                 codigo_iso3           varchar(3),
                                 nombre                varchar(100) NOT NULL UNIQUE,
                                 activo                boolean NOT NULL DEFAULT true,
                                 fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                 fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.departamentos (
                                        id_departamento       uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                        id_pais               uuid NOT NULL REFERENCES maestros.paises(id_pais),
                                        codigo                varchar(10),
                                        nombre                varchar(120) NOT NULL,
                                        activo                boolean NOT NULL DEFAULT true,
                                        fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                        fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                        UNIQUE(id_pais, nombre)
);

CREATE TABLE maestros.ciudades (
                                   id_ciudad             uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                   id_departamento       uuid NOT NULL REFERENCES maestros.departamentos(id_departamento),
                                   codigo                varchar(10),
                                   nombre                varchar(120) NOT NULL,
                                   activo                boolean NOT NULL DEFAULT true,
                                   fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                   fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                   UNIQUE(id_departamento, nombre)
);

CREATE TABLE maestros.unidades_medida (
                                          id_unidad_medida      uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                          codigo                varchar(20) NOT NULL UNIQUE,
                                          nombre                varchar(100) NOT NULL UNIQUE,
                                          descripcion           text,
                                          activo                boolean NOT NULL DEFAULT true,
                                          fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                          fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.monedas (
                                  id_moneda             uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                  codigo                varchar(10) NOT NULL UNIQUE,
                                  nombre                varchar(100) NOT NULL,
                                  simbolo               varchar(10),
                                  activo                boolean NOT NULL DEFAULT true,
                                  fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                  fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.tipos_documento_identidad (
                                                    id_tipo_documento_identidad uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                    codigo                varchar(10) NOT NULL UNIQUE,
                                                    nombre                varchar(100) NOT NULL UNIQUE,
                                                    aplica_persona_natural boolean NOT NULL DEFAULT true,
                                                    aplica_persona_juridica boolean NOT NULL DEFAULT true,
                                                    activo                boolean NOT NULL DEFAULT true,
                                                    fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                    fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.tipos_impuesto (
                                         id_tipo_impuesto      uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                         codigo                varchar(20) NOT NULL UNIQUE,
                                         nombre                varchar(100) NOT NULL,
                                         descripcion           text,
                                         activo                boolean NOT NULL DEFAULT true,
                                         fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                         fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.tasas_impuesto (
                                         id_tasa_impuesto      uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                         id_tipo_impuesto      uuid NOT NULL REFERENCES maestros.tipos_impuesto(id_tipo_impuesto),
                                         nombre                varchar(100) NOT NULL,
                                         porcentaje            numeric(8,4) NOT NULL CHECK (porcentaje >= 0),
                                         fecha_inicio_vigencia date NOT NULL,
                                         fecha_fin_vigencia    date,
                                         activo                boolean NOT NULL DEFAULT true,
                                         fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                         fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                         CHECK (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= fecha_inicio_vigencia)
);

CREATE TABLE maestros.estados_generales (
                                            id_estado_general     uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                            modulo                varchar(60) NOT NULL,
                                            codigo                varchar(40) NOT NULL,
                                            nombre                varchar(100) NOT NULL,
                                            descripcion           text,
                                            orden_visual          integer NOT NULL DEFAULT 0,
                                            activo                boolean NOT NULL DEFAULT true,
                                            fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                            fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                            UNIQUE(modulo, codigo)
);

-- =========================================================
-- SEGURIDAD
-- =========================================================
CREATE TABLE seguridad.usuarios (
                                    id_usuario            uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                    id_tipo_documento_identidad uuid REFERENCES maestros.tipos_documento_identidad(id_tipo_documento_identidad),
                                    numero_documento      varchar(50),
                                    nombres               varchar(120) NOT NULL,
                                    apellidos             varchar(120) NOT NULL,
                                    correo_electronico    varchar(180) NOT NULL UNIQUE,
                                    telefono              varchar(30),
                                    nombre_usuario        varchar(80) NOT NULL UNIQUE,
                                    hash_contrasena       text NOT NULL,
                                    requiere_cambio_clave boolean NOT NULL DEFAULT true,
                                    activo                boolean NOT NULL DEFAULT true,
                                    bloqueado             boolean NOT NULL DEFAULT false,
                                    fecha_ultimo_ingreso  timestamp,
                                    intentos_fallidos     integer NOT NULL DEFAULT 0,
                                    url_firma_digital     text,
                                    fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                    fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE seguridad.roles (
                                 id_rol                uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                 codigo                varchar(40) NOT NULL UNIQUE,
                                 nombre                varchar(120) NOT NULL UNIQUE,
                                 descripcion           text,
                                 es_rol_sistema        boolean NOT NULL DEFAULT false,
                                 activo                boolean NOT NULL DEFAULT true,
                                 fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                 fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE seguridad.permisos (
                                    id_permiso            uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                    modulo                varchar(80) NOT NULL,
                                    codigo                varchar(80) NOT NULL UNIQUE,
                                    nombre                varchar(140) NOT NULL,
                                    descripcion           text,
                                    accion                varchar(40) NOT NULL,
                                    activo                boolean NOT NULL DEFAULT true,
                                    fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                    fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE seguridad.roles_permisos (
                                          id_rol_permiso        uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                          id_rol                uuid NOT NULL REFERENCES seguridad.roles(id_rol) ON DELETE CASCADE,
                                          id_permiso            uuid NOT NULL REFERENCES seguridad.permisos(id_permiso) ON DELETE CASCADE,
                                          fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                          UNIQUE(id_rol, id_permiso)
);

CREATE TABLE seguridad.usuarios_roles (
                                          id_usuario_rol        uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                          id_usuario            uuid NOT NULL REFERENCES seguridad.usuarios(id_usuario) ON DELETE CASCADE,
                                          id_rol                uuid NOT NULL REFERENCES seguridad.roles(id_rol) ON DELETE CASCADE,
                                          fecha_asignacion      timestamp NOT NULL DEFAULT now(),
                                          fecha_revocacion      timestamp,
                                          activo                boolean NOT NULL DEFAULT true,
                                          UNIQUE(id_usuario, id_rol, fecha_asignacion)
);

CREATE TABLE seguridad.sesiones_usuario (
                                            id_sesion             uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                            id_usuario            uuid NOT NULL REFERENCES seguridad.usuarios(id_usuario) ON DELETE CASCADE,
                                            token_sesion          text NOT NULL UNIQUE,
                                            direccion_ip          inet,
                                            agente_usuario        text,
                                            fecha_inicio          timestamp NOT NULL DEFAULT now(),
                                            fecha_expiracion      timestamp NOT NULL,
                                            fecha_cierre          timestamp,
                                            activa                boolean NOT NULL DEFAULT true
);

-- =========================================================
-- MAESTROS DE TERCEROS
-- =========================================================
CREATE TABLE maestros.terceros (
                                   id_tercero            uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                   tipo_tercero          varchar(30) NOT NULL CHECK (tipo_tercero IN ('PROVEEDOR','CLIENTE','EMPLEADO','FABRICANTE','IMPORTADOR','TRANSPORTISTA','OTRO')),
                                   tipo_persona          varchar(20) NOT NULL CHECK (tipo_persona IN ('NATURAL','JURIDICA')),
                                   id_tipo_documento_identidad uuid REFERENCES maestros.tipos_documento_identidad(id_tipo_documento_identidad),
                                   numero_documento      varchar(50) NOT NULL,
                                   digito_verificacion   varchar(5),
                                   razon_social          varchar(180),
                                   nombres               varchar(120),
                                   apellidos             varchar(120),
                                   nombre_comercial      varchar(180),
                                   correo_electronico    varchar(180),
                                   telefono_principal    varchar(30),
                                   telefono_secundario   varchar(30),
                                   sitio_web             varchar(255),
                                   responsable_contacto  varchar(180),
                                   regimen_tributario    varchar(100),
                                   obligado_facturar     boolean NOT NULL DEFAULT true,
                                   gran_contribuyente    boolean NOT NULL DEFAULT false,
                                   autorretenedor        boolean NOT NULL DEFAULT false,
                                   agente_retencion      boolean NOT NULL DEFAULT false,
                                   activo                boolean NOT NULL DEFAULT true,
                                   observaciones         text,
                                   fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                   fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                   UNIQUE(tipo_tercero, numero_documento)
);

CREATE TABLE maestros.direcciones_tercero (
                                              id_direccion_tercero  uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                              id_tercero            uuid NOT NULL REFERENCES maestros.terceros(id_tercero) ON DELETE CASCADE,
                                              id_pais               uuid REFERENCES maestros.paises(id_pais),
                                              id_departamento       uuid REFERENCES maestros.departamentos(id_departamento),
                                              id_ciudad             uuid REFERENCES maestros.ciudades(id_ciudad),
                                              direccion_linea_1     varchar(255) NOT NULL,
                                              direccion_linea_2     varchar(255),
                                              codigo_postal         varchar(20),
                                              es_principal          boolean NOT NULL DEFAULT false,
                                              tipo_direccion        varchar(40) NOT NULL CHECK (tipo_direccion IN ('PRINCIPAL','FACTURACION','ENVIO','BODEGA','OTRA')),
                                              latitud               numeric(10,7),
                                              longitud              numeric(10,7),
                                              activo                boolean NOT NULL DEFAULT true,
                                              fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                              fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.cuentas_bancarias_tercero (
                                                    id_cuenta_bancaria_tercero uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                    id_tercero            uuid NOT NULL REFERENCES maestros.terceros(id_tercero) ON DELETE CASCADE,
                                                    banco                 varchar(120) NOT NULL,
                                                    tipo_cuenta           varchar(20) NOT NULL CHECK (tipo_cuenta IN ('AHORROS','CORRIENTE','OTRA')),
                                                    numero_cuenta         varchar(60) NOT NULL,
                                                    titular               varchar(180),
                                                    moneda                varchar(10) DEFAULT 'COP',
                                                    es_principal          boolean NOT NULL DEFAULT false,
                                                    activa                boolean NOT NULL DEFAULT true,
                                                    fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                    fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.documentos_tercero (
                                             id_documento_tercero  uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                             id_tercero            uuid NOT NULL REFERENCES maestros.terceros(id_tercero) ON DELETE CASCADE,
                                             tipo_documento        varchar(60) NOT NULL,
                                             nombre_documento      varchar(180) NOT NULL,
                                             numero_documento      varchar(80),
                                             fecha_emision         date,
                                             fecha_vencimiento     date,
                                             url_archivo           text NOT NULL,
                                             hash_archivo          text,
                                             version               integer NOT NULL DEFAULT 1,
                                             vigente               boolean NOT NULL DEFAULT true,
                                             observaciones         text,
                                             fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                             fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- BODEGAS Y ESTRUCTURA FÍSICA
-- =========================================================
CREATE TABLE inventario.sucursales (
                                       id_sucursal           uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                       codigo                varchar(30) NOT NULL UNIQUE,
                                       nombre                varchar(120) NOT NULL,
                                       id_direccion_tercero  uuid,
                                       telefono              varchar(30),
                                       correo_electronico    varchar(180),
                                       activa                boolean NOT NULL DEFAULT true,
                                       fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                       fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE inventario.bodegas (
                                    id_bodega             uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                    id_sucursal           uuid REFERENCES inventario.sucursales(id_sucursal),
                                    codigo                varchar(30) NOT NULL UNIQUE,
                                    nombre                varchar(120) NOT NULL,
                                    tipo_bodega           varchar(40) NOT NULL CHECK (tipo_bodega IN ('PRINCIPAL','TIENDA','TRANSITO','CUARENTENA','DEVOLUCIONES','CONSIGNACION','OTRA')),
                                    id_pais               uuid REFERENCES maestros.paises(id_pais),
                                    id_departamento       uuid REFERENCES maestros.departamentos(id_departamento),
                                    id_ciudad             uuid REFERENCES maestros.ciudades(id_ciudad),
                                    direccion             varchar(255),
                                    responsable_id_usuario uuid REFERENCES seguridad.usuarios(id_usuario),
                                    permite_ventas        boolean NOT NULL DEFAULT false,
                                    permite_compras       boolean NOT NULL DEFAULT true,
                                    permite_traslados     boolean NOT NULL DEFAULT true,
                                    requiere_aprobacion_ajustes boolean NOT NULL DEFAULT true,
                                    activa                boolean NOT NULL DEFAULT true,
                                    observaciones         text,
                                    fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                    fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE inventario.zonas_bodega (
                                         id_zona_bodega        uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                         id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega) ON DELETE CASCADE,
                                         codigo                varchar(30) NOT NULL,
                                         nombre                varchar(120) NOT NULL,
                                         tipo_zona             varchar(40) NOT NULL CHECK (tipo_zona IN ('RECEPCION','ALMACENAMIENTO','DESPACHO','CUARENTENA','DEVOLUCION','PICKING','OTRA')),
                                         activa                boolean NOT NULL DEFAULT true,
                                         fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                         fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                         UNIQUE(id_bodega, codigo)
);

CREATE TABLE inventario.ubicaciones (
                                        id_ubicacion          uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                        id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega) ON DELETE CASCADE,
                                        id_zona_bodega        uuid REFERENCES inventario.zonas_bodega(id_zona_bodega),
                                        codigo                varchar(40) NOT NULL,
                                        pasillo               varchar(20),
                                        estante               varchar(20),
                                        nivel                 varchar(20),
                                        posicion              varchar(20),
                                        capacidad_unidades    numeric(18,4),
                                        capacidad_volumen     numeric(18,4),
                                        capacidad_peso        numeric(18,4),
                                        bloqueada             boolean NOT NULL DEFAULT false,
                                        activa                boolean NOT NULL DEFAULT true,
                                        fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                        fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                        UNIQUE(id_bodega, codigo)
);

-- =========================================================
-- PRODUCTOS Y MAESTROS COMERCIALES
-- =========================================================
CREATE TABLE maestros.categorias_producto (
                                              id_categoria_producto uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                              id_categoria_padre    uuid REFERENCES maestros.categorias_producto(id_categoria_producto),
                                              codigo                varchar(40) NOT NULL UNIQUE,
                                              nombre                varchar(120) NOT NULL,
                                              descripcion           text,
                                              nivel                 integer NOT NULL DEFAULT 1 CHECK (nivel >= 1),
                                              permite_venta_menores boolean NOT NULL DEFAULT false,
                                              activo                boolean NOT NULL DEFAULT true,
                                              fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                              fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.marcas (
                                 id_marca              uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                 codigo                varchar(40) UNIQUE,
                                 nombre                varchar(120) NOT NULL UNIQUE,
                                 descripcion           text,
                                 id_fabricante_tercero uuid REFERENCES maestros.terceros(id_tercero),
                                 activa                boolean NOT NULL DEFAULT true,
                                 fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                 fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.etiquetas_producto (
                                             id_etiqueta_producto  uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                             codigo                varchar(40) NOT NULL UNIQUE,
                                             nombre                varchar(120) NOT NULL UNIQUE,
                                             descripcion           text,
                                             activa                boolean NOT NULL DEFAULT true,
                                             fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                             fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.productos (
                                    id_producto           uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                    sku                   varchar(60) NOT NULL UNIQUE,
                                    codigo_barras         varchar(100),
                                    nombre                varchar(180) NOT NULL,
                                    nombre_corto          varchar(100),
                                    descripcion           text,
                                    id_categoria_producto uuid NOT NULL REFERENCES maestros.categorias_producto(id_categoria_producto),
                                    id_marca              uuid REFERENCES maestros.marcas(id_marca),
                                    id_fabricante_tercero uuid REFERENCES maestros.terceros(id_tercero),
                                    id_importador_tercero uuid REFERENCES maestros.terceros(id_tercero),
                                    id_unidad_medida_base uuid NOT NULL REFERENCES maestros.unidades_medida(id_unidad_medida),
                                    tipo_producto         varchar(40) NOT NULL CHECK (tipo_producto IN ('ACCESORIO','JUGUETE_SEXUAL','LUBRICANTE','PRESERVATIVO','COSMETICO','LENCERIA','BDSM','HIGIENE','OTRO')),
                                    subtipo_producto      varchar(80),
                                    es_inventariable      boolean NOT NULL DEFAULT true,
                                    maneja_lotes          boolean NOT NULL DEFAULT false,
                                    maneja_vencimiento    boolean NOT NULL DEFAULT false,
                                    requiere_registro_sanitario boolean NOT NULL DEFAULT false,
                                    requiere_control_mayoria_edad boolean NOT NULL DEFAULT true,
                                    es_restringido        boolean NOT NULL DEFAULT true,
                                    es_kit                boolean NOT NULL DEFAULT false,
                                    peso                  numeric(18,4),
                                    alto                  numeric(18,4),
                                    ancho                 numeric(18,4),
                                    largo                 numeric(18,4),
                                    volumen               numeric(18,4),
                                    color                 varchar(60),
                                    material              varchar(100),
                                    pais_origen_id        uuid REFERENCES maestros.paises(id_pais),
                                    vida_util_dias        integer,
                                    temperatura_minima    numeric(8,2),
                                    temperatura_maxima    numeric(8,2),
                                    stock_minimo          numeric(18,4) NOT NULL DEFAULT 0,
                                    stock_maximo          numeric(18,4),
                                    punto_reorden         numeric(18,4),
                                    dias_cobertura_objetivo integer,
                                    url_imagen_principal  text,
                                    activo                boolean NOT NULL DEFAULT true,
                                    observaciones         text,
                                    fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                    fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                    CHECK (stock_minimo >= 0),
                                    CHECK (stock_maximo IS NULL OR stock_maximo >= stock_minimo)
);

CREATE TABLE maestros.productos_etiquetas (
                                              id_producto_etiqueta  uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                              id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto) ON DELETE CASCADE,
                                              id_etiqueta_producto  uuid NOT NULL REFERENCES maestros.etiquetas_producto(id_etiqueta_producto) ON DELETE CASCADE,
                                              fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                              UNIQUE(id_producto, id_etiqueta_producto)
);

CREATE TABLE maestros.productos_embalajes (
                                              id_producto_embalaje  uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                              id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto) ON DELETE CASCADE,
                                              nombre                varchar(120) NOT NULL,
                                              tipo_embalaje         varchar(40) NOT NULL CHECK (tipo_embalaje IN ('UNIDAD','CAJA','PAQUETE','MASTER','PALLET','OTRO')),
                                              cantidad_unidades_base numeric(18,4) NOT NULL CHECK (cantidad_unidades_base > 0),
                                              id_unidad_medida      uuid REFERENCES maestros.unidades_medida(id_unidad_medida),
                                              peso                  numeric(18,4),
                                              alto                  numeric(18,4),
                                              ancho                 numeric(18,4),
                                              largo                 numeric(18,4),
                                              codigo_barras         varchar(100),
                                              es_venta              boolean NOT NULL DEFAULT false,
                                              es_compra             boolean NOT NULL DEFAULT false,
                                              es_logistico          boolean NOT NULL DEFAULT false,
                                              activo                boolean NOT NULL DEFAULT true,
                                              fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                              fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                              UNIQUE(id_producto, nombre)
);

CREATE TABLE maestros.productos_componentes (
                                                id_producto_componente uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                id_producto_padre     uuid NOT NULL REFERENCES maestros.productos(id_producto) ON DELETE CASCADE,
                                                id_producto_hijo      uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                cantidad              numeric(18,4) NOT NULL CHECK (cantidad > 0),
                                                obligatorio           boolean NOT NULL DEFAULT true,
                                                fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                UNIQUE(id_producto_padre, id_producto_hijo)
);

CREATE TABLE maestros.productos_impuestos (
                                              id_producto_impuesto  uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                              id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto) ON DELETE CASCADE,
                                              id_tasa_impuesto      uuid NOT NULL REFERENCES maestros.tasas_impuesto(id_tasa_impuesto),
                                              tipo_aplicacion       varchar(20) NOT NULL CHECK (tipo_aplicacion IN ('COMPRA','VENTA','AMBOS')),
                                              fecha_inicio_vigencia date NOT NULL DEFAULT current_date,
                                              fecha_fin_vigencia    date,
                                              activo                boolean NOT NULL DEFAULT true,
                                              fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                              UNIQUE(id_producto, id_tasa_impuesto, tipo_aplicacion, fecha_inicio_vigencia)
);

CREATE TABLE maestros.productos_documentos (
                                               id_producto_documento uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                               id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto) ON DELETE CASCADE,
                                               tipo_documento        varchar(60) NOT NULL,
                                               nombre_documento      varchar(180) NOT NULL,
                                               numero_documento      varchar(80),
                                               fecha_emision         date,
                                               fecha_vencimiento     date,
                                               entidad_emisora       varchar(180),
                                               url_archivo           text NOT NULL,
                                               hash_archivo          text,
                                               version               integer NOT NULL DEFAULT 1,
                                               vigente               boolean NOT NULL DEFAULT true,
                                               observaciones         text,
                                               fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                               fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE cumplimiento.registros_sanitarios_producto (
                                                            id_registro_sanitario_producto uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                            id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto) ON DELETE CASCADE,
                                                            entidad_reguladora    varchar(120) NOT NULL DEFAULT 'INVIMA',
                                                            tipo_registro         varchar(80) NOT NULL,
                                                            numero_registro       varchar(100) NOT NULL,
                                                            fecha_emision         date,
                                                            fecha_vencimiento     date,
                                                            estado_registro       varchar(30) NOT NULL CHECK (estado_registro IN ('VIGENTE','VENCIDO','SUSPENDIDO','CANCELADO','EN_TRAMITE')),
                                                            titular_registro      varchar(180),
                                                            url_soporte           text,
                                                            observaciones         text,
                                                            activo                boolean NOT NULL DEFAULT true,
                                                            fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                            fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                                            UNIQUE(id_producto, numero_registro)
);

-- =========================================================
-- PRECIOS Y COSTOS
-- =========================================================
CREATE TABLE maestros.canales_venta (
                                        id_canal_venta        uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                        codigo                varchar(40) NOT NULL UNIQUE,
                                        nombre                varchar(120) NOT NULL UNIQUE,
                                        tipo_canal            varchar(40) NOT NULL CHECK (tipo_canal IN ('TIENDA_FISICA','ECOMMERCE','MARKETPLACE','MAYORISTA','OTRO')),
                                        activo                boolean NOT NULL DEFAULT true,
                                        fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                        fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.listas_precios (
                                         id_lista_precio       uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                         codigo                varchar(40) NOT NULL UNIQUE,
                                         nombre                varchar(120) NOT NULL,
                                         id_moneda             uuid NOT NULL REFERENCES maestros.monedas(id_moneda),
                                         id_canal_venta        uuid REFERENCES maestros.canales_venta(id_canal_venta),
                                         descripcion           text,
                                         fecha_inicio_vigencia date NOT NULL,
                                         fecha_fin_vigencia    date,
                                         activa                boolean NOT NULL DEFAULT true,
                                         fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                         fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE maestros.precios_producto (
                                           id_precio_producto    uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                           id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto) ON DELETE CASCADE,
                                           id_lista_precio       uuid NOT NULL REFERENCES maestros.listas_precios(id_lista_precio) ON DELETE CASCADE,
                                           precio_base           numeric(18,2) NOT NULL CHECK (precio_base >= 0),
                                           costo_referencia      numeric(18,2) CHECK (costo_referencia >= 0),
                                           margen_objetivo_pct   numeric(8,4),
                                           precio_minimo         numeric(18,2),
                                           precio_maximo         numeric(18,2),
                                           incluye_impuestos     boolean NOT NULL DEFAULT true,
                                           fecha_inicio_vigencia date NOT NULL DEFAULT current_date,
                                           fecha_fin_vigencia    date,
                                           activo                boolean NOT NULL DEFAULT true,
                                           creado_por            uuid REFERENCES seguridad.usuarios(id_usuario),
                                           fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                           fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                           UNIQUE(id_producto, id_lista_precio, fecha_inicio_vigencia)
);

-- =========================================================
-- LOTES, EXISTENCIAS Y RESERVAS
-- =========================================================
CREATE TABLE inventario.lotes_producto (
                                           id_lote_producto      uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                           id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                           numero_lote           varchar(100) NOT NULL,
                                           fecha_fabricacion     date,
                                           fecha_vencimiento     date,
                                           id_registro_sanitario_producto uuid REFERENCES cumplimiento.registros_sanitarios_producto(id_registro_sanitario_producto),
                                           estado_lote           varchar(30) NOT NULL DEFAULT 'DISPONIBLE' CHECK (estado_lote IN ('DISPONIBLE','CUARENTENA','BLOQUEADO','VENCIDO','AGOTADO')),
                                           observaciones         text,
                                           fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                           fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                           UNIQUE(id_producto, numero_lote)
);

CREATE TABLE inventario.existencias (
                                        id_existencia         uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                        id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                        id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                        id_ubicacion          uuid REFERENCES inventario.ubicaciones(id_ubicacion),
                                        id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                        cantidad_disponible   numeric(18,4) NOT NULL DEFAULT 0,
                                        cantidad_reservada    numeric(18,4) NOT NULL DEFAULT 0,
                                        cantidad_bloqueada    numeric(18,4) NOT NULL DEFAULT 0,
                                        cantidad_transito_entrada numeric(18,4) NOT NULL DEFAULT 0,
                                        cantidad_transito_salida  numeric(18,4) NOT NULL DEFAULT 0,
                                        costo_promedio        numeric(18,6) NOT NULL DEFAULT 0,
                                        fecha_ultima_movilizacion timestamp,
                                        fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                        fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                        UNIQUE(id_producto, id_bodega, id_ubicacion, id_lote_producto)
);

CREATE TABLE inventario.reservas_inventario (
                                                id_reserva_inventario uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                                id_ubicacion          uuid REFERENCES inventario.ubicaciones(id_ubicacion),
                                                id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                tipo_origen           varchar(40) NOT NULL CHECK (tipo_origen IN ('VENTA','PEDIDO_ECOMMERCE','TRASLADO','APARTADO','OTRO')),
                                                id_documento_origen   uuid,
                                                cantidad              numeric(18,4) NOT NULL CHECK (cantidad > 0),
                                                fecha_reserva         timestamp NOT NULL DEFAULT now(),
                                                fecha_vencimiento     timestamp,
                                                estado                varchar(20) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','LIBERADA','CONSUMIDA','VENCIDA','ANULADA')),
                                                observaciones         text,
                                                creado_por            uuid REFERENCES seguridad.usuarios(id_usuario),
                                                fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- MOVIMIENTOS DE INVENTARIO / KARDEX
-- =========================================================
CREATE TABLE inventario.tipos_movimiento_inventario (
                                                        id_tipo_movimiento_inventario uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                        codigo                varchar(40) NOT NULL UNIQUE,
                                                        nombre                varchar(120) NOT NULL,
                                                        naturaleza            varchar(20) NOT NULL CHECK (naturaleza IN ('ENTRADA','SALIDA','TRASLADO','AJUSTE','RESERVA','LIBERACION','BLOQUEO','DESBLOQUEO')),
                                                        afecta_costo          boolean NOT NULL DEFAULT true,
                                                        requiere_aprobacion   boolean NOT NULL DEFAULT false,
                                                        activo                boolean NOT NULL DEFAULT true,
                                                        fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                        fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE inventario.documentos_movimiento_inventario (
                                                             id_documento_movimiento_inventario uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                             tipo_documento        varchar(50) NOT NULL,
                                                             prefijo               varchar(20),
                                                             numero_documento      varchar(50) NOT NULL,
                                                             fecha_documento       timestamp NOT NULL DEFAULT now(),
                                                             estado                varchar(20) NOT NULL CHECK (estado IN ('BORRADOR','PENDIENTE','APROBADO','APLICADO','ANULADO','RECHAZADO')),
                                                             id_bodega_origen      uuid REFERENCES inventario.bodegas(id_bodega),
                                                             id_bodega_destino     uuid REFERENCES inventario.bodegas(id_bodega),
                                                             id_tercero            uuid REFERENCES maestros.terceros(id_tercero),
                                                             id_usuario_responsable uuid REFERENCES seguridad.usuarios(id_usuario),
                                                             motivo                varchar(120),
                                                             observaciones         text,
                                                             referencia_externa    varchar(100),
                                                             fecha_aprobacion      timestamp,
                                                             aprobado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                                             fecha_aplicacion      timestamp,
                                                             aplicado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                                             fecha_anulacion       timestamp,
                                                             anulado_por           uuid REFERENCES seguridad.usuarios(id_usuario),
                                                             razon_anulacion       text,
                                                             fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                             fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                                             UNIQUE(tipo_documento, prefijo, numero_documento)
);

CREATE TABLE inventario.movimientos_inventario (
                                                   id_movimiento_inventario uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                   id_documento_movimiento_inventario uuid NOT NULL REFERENCES inventario.documentos_movimiento_inventario(id_documento_movimiento_inventario) ON DELETE CASCADE,
                                                   id_tipo_movimiento_inventario uuid NOT NULL REFERENCES inventario.tipos_movimiento_inventario(id_tipo_movimiento_inventario),
                                                   id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                   id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                                   id_ubicacion          uuid REFERENCES inventario.ubicaciones(id_ubicacion),
                                                   id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                   cantidad              numeric(18,4) NOT NULL,
                                                   costo_unitario        numeric(18,6) NOT NULL DEFAULT 0,
                                                   valor_total           numeric(18,2) GENERATED ALWAYS AS (round(cantidad * costo_unitario, 2)) STORED,
                                                   signo                 integer NOT NULL CHECK (signo IN (-1, 1)),
                                                   saldo_cantidad_anterior numeric(18,4),
                                                   saldo_cantidad_nuevo  numeric(18,4),
                                                   saldo_valor_anterior  numeric(18,2),
                                                   saldo_valor_nuevo     numeric(18,2),
                                                   detalle               text,
                                                   orden_linea           integer NOT NULL DEFAULT 1,
                                                   fecha_movimiento      timestamp NOT NULL DEFAULT now(),
                                                   fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                   CHECK (cantidad > 0)
);

CREATE INDEX idx_movimientos_inventario_producto_bodega_fecha
    ON inventario.movimientos_inventario(id_producto, id_bodega, fecha_movimiento);

CREATE INDEX idx_existencias_producto_bodega
    ON inventario.existencias(id_producto, id_bodega);

-- =========================================================
-- TRANSFERENCIAS ENTRE BODEGAS
-- =========================================================
CREATE TABLE inventario.solicitudes_traslado (
                                                 id_solicitud_traslado uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                 codigo                varchar(50) NOT NULL UNIQUE,
                                                 id_bodega_origen      uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                                 id_bodega_destino     uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                                 estado                varchar(20) NOT NULL CHECK (estado IN ('BORRADOR','SOLICITADO','APROBADO','DESPACHADO','RECIBIDO','ANULADO','RECHAZADO')),
                                                 fecha_solicitud       timestamp NOT NULL DEFAULT now(),
                                                 solicitado_por        uuid REFERENCES seguridad.usuarios(id_usuario),
                                                 fecha_aprobacion      timestamp,
                                                 aprobado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                                 fecha_despacho        timestamp,
                                                 despachado_por        uuid REFERENCES seguridad.usuarios(id_usuario),
                                                 fecha_recepcion       timestamp,
                                                 recibido_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                                 observaciones         text,
                                                 referencia_externa    varchar(100),
                                                 fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                 fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                                 CHECK (id_bodega_origen <> id_bodega_destino)
);

CREATE TABLE inventario.detalles_solicitud_traslado (
                                                        id_detalle_solicitud_traslado uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                        id_solicitud_traslado uuid NOT NULL REFERENCES inventario.solicitudes_traslado(id_solicitud_traslado) ON DELETE CASCADE,
                                                        id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                        id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                        cantidad_solicitada   numeric(18,4) NOT NULL CHECK (cantidad_solicitada > 0),
                                                        cantidad_aprobada     numeric(18,4) NOT NULL DEFAULT 0 CHECK (cantidad_aprobada >= 0),
                                                        cantidad_despachada   numeric(18,4) NOT NULL DEFAULT 0 CHECK (cantidad_despachada >= 0),
                                                        cantidad_recibida     numeric(18,4) NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
                                                        costo_unitario        numeric(18,6) NOT NULL DEFAULT 0,
                                                        observaciones         text,
                                                        fecha_creacion        timestamp NOT NULL DEFAULT now()
);

CREATE TABLE inventario.transferencias_internas_ubicacion (
                                                              id_transferencia_interna_ubicacion uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                              codigo                varchar(50) NOT NULL UNIQUE,
                                                              id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                                              id_ubicacion_origen   uuid NOT NULL REFERENCES inventario.ubicaciones(id_ubicacion),
                                                              id_ubicacion_destino  uuid NOT NULL REFERENCES inventario.ubicaciones(id_ubicacion),
                                                              estado                varchar(20) NOT NULL CHECK (estado IN ('BORRADOR','APROBADA','APLICADA','ANULADA')),
                                                              fecha_documento       timestamp NOT NULL DEFAULT now(),
                                                              motivo                varchar(120),
                                                              creado_por            uuid REFERENCES seguridad.usuarios(id_usuario),
                                                              aplicado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                                              observaciones         text,
                                                              fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                              fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                                              CHECK (id_ubicacion_origen <> id_ubicacion_destino)
);

CREATE TABLE inventario.detalles_transferencia_interna_ubicacion (
                                                                     id_detalle_transferencia_interna_ubicacion uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                                     id_transferencia_interna_ubicacion uuid NOT NULL REFERENCES inventario.transferencias_internas_ubicacion(id_transferencia_interna_ubicacion) ON DELETE CASCADE,
                                                                     id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                                     id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                                     cantidad              numeric(18,4) NOT NULL CHECK (cantidad > 0),
                                                                     costo_unitario        numeric(18,6) NOT NULL DEFAULT 0,
                                                                     fecha_creacion        timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- CONTEOS E INVENTARIOS FÍSICOS
-- =========================================================
CREATE TABLE inventario.conteos_inventario (
                                               id_conteo_inventario  uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                               codigo                varchar(50) NOT NULL UNIQUE,
                                               tipo_conteo           varchar(30) NOT NULL CHECK (tipo_conteo IN ('CICLICO','GENERAL','SELECTIVO')),
                                               id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                               estado                varchar(20) NOT NULL CHECK (estado IN ('PROGRAMADO','EN_EJECUCION','CERRADO','ANULADO')),
                                               fecha_programada      timestamp NOT NULL,
                                               fecha_inicio          timestamp,
                                               fecha_cierre          timestamp,
                                               congelar_movimientos  boolean NOT NULL DEFAULT false,
                                               observaciones         text,
                                               creado_por            uuid REFERENCES seguridad.usuarios(id_usuario),
                                               cerrado_por           uuid REFERENCES seguridad.usuarios(id_usuario),
                                               fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                               fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE inventario.detalles_conteo_inventario (
                                                       id_detalle_conteo_inventario uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                       id_conteo_inventario  uuid NOT NULL REFERENCES inventario.conteos_inventario(id_conteo_inventario) ON DELETE CASCADE,
                                                       id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                       id_ubicacion          uuid REFERENCES inventario.ubicaciones(id_ubicacion),
                                                       id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                       cantidad_sistema      numeric(18,4) NOT NULL DEFAULT 0,
                                                       cantidad_contada      numeric(18,4),
                                                       diferencia            numeric(18,4) GENERATED ALWAYS AS (coalesce(cantidad_contada,0) - cantidad_sistema) STORED,
                                                       observaciones         text,
                                                       contado_por           uuid REFERENCES seguridad.usuarios(id_usuario),
                                                       reconteo_requerido    boolean NOT NULL DEFAULT false,
                                                       fecha_conteo          timestamp,
                                                       fecha_creacion        timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- AJUSTES
-- =========================================================
CREATE TABLE inventario.ajustes_inventario (
                                               id_ajuste_inventario  uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                               codigo                varchar(50) NOT NULL UNIQUE,
                                               tipo_ajuste           varchar(30) NOT NULL CHECK (tipo_ajuste IN ('DIFERENCIA_CONTEO','MERMA','DANO','VENCIMIENTO','HURTO','REGULARIZACION','OTRO')),
                                               id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                               estado                varchar(30) NOT NULL CHECK (estado IN ('BORRADOR','PENDIENTE_APROBACION','APROBADO','APLICADO','RECHAZADO','ANULADO')),
                                               motivo                varchar(180) NOT NULL,
                                               evidencia_url         text,
                                               observaciones         text,
                                               valor_estimado        numeric(18,2),
                                               creado_por            uuid REFERENCES seguridad.usuarios(id_usuario),
                                               aprobado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                               fecha_aprobacion      timestamp,
                                               aplicado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                               fecha_aplicacion      timestamp,
                                               fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                               fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE inventario.detalles_ajuste_inventario (
                                                       id_detalle_ajuste_inventario uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                       id_ajuste_inventario  uuid NOT NULL REFERENCES inventario.ajustes_inventario(id_ajuste_inventario) ON DELETE CASCADE,
                                                       id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                       id_ubicacion          uuid REFERENCES inventario.ubicaciones(id_ubicacion),
                                                       id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                       cantidad_sistema      numeric(18,4) NOT NULL DEFAULT 0,
                                                       cantidad_ajuste       numeric(18,4) NOT NULL,
                                                       costo_unitario        numeric(18,6) NOT NULL DEFAULT 0,
                                                       observaciones         text,
                                                       fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                       CHECK (cantidad_ajuste <> 0)
);

CREATE TABLE inventario.bloqueos_inventario (
                                                id_bloqueo_inventario uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                                id_ubicacion          uuid REFERENCES inventario.ubicaciones(id_ubicacion),
                                                id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                tipo_bloqueo          varchar(30) NOT NULL CHECK (tipo_bloqueo IN ('CUARENTENA','ALERTA_SANITARIA','DANO','INVESTIGACION','VENCIMIENTO','OTRO')),
                                                cantidad_bloqueada    numeric(18,4) NOT NULL CHECK (cantidad_bloqueada > 0),
                                                fecha_inicio          timestamp NOT NULL DEFAULT now(),
                                                fecha_fin             timestamp,
                                                estado                varchar(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','LIBERADO','CONSUMIDO','ANULADO')),
                                                motivo                text NOT NULL,
                                                creado_por            uuid REFERENCES seguridad.usuarios(id_usuario),
                                                liberado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                                fecha_liberacion      timestamp,
                                                observaciones         text,
                                                fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- COMPRAS
-- =========================================================
CREATE TABLE compras.condiciones_pago (
                                          id_condicion_pago     uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                          codigo                varchar(40) NOT NULL UNIQUE,
                                          nombre                varchar(120) NOT NULL,
                                          dias_credito          integer NOT NULL DEFAULT 0 CHECK (dias_credito >= 0),
                                          descripcion           text,
                                          activa                boolean NOT NULL DEFAULT true,
                                          fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                          fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE compras.ordenes_compra (
                                        id_orden_compra       uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                        prefijo               varchar(20),
                                        numero_orden          varchar(50) NOT NULL,
                                        id_proveedor          uuid NOT NULL REFERENCES maestros.terceros(id_tercero),
                                        id_bodega_destino     uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                        id_condicion_pago     uuid REFERENCES compras.condiciones_pago(id_condicion_pago),
                                        id_moneda             uuid NOT NULL REFERENCES maestros.monedas(id_moneda),
                                        tasa_cambio           numeric(18,6) NOT NULL DEFAULT 1,
                                        estado                varchar(30) NOT NULL CHECK (estado IN ('BORRADOR','PENDIENTE_APROBACION','APROBADA','PARCIALMENTE_RECIBIDA','RECIBIDA','CANCELADA','RECHAZADA')),
                                        fecha_emision         timestamp NOT NULL DEFAULT now(),
                                        fecha_entrega_estimada date,
                                        subtotal              numeric(18,2) NOT NULL DEFAULT 0,
                                        total_descuento       numeric(18,2) NOT NULL DEFAULT 0,
                                        total_impuestos       numeric(18,2) NOT NULL DEFAULT 0,
                                        total_general         numeric(18,2) NOT NULL DEFAULT 0,
                                        observaciones         text,
                                        creado_por            uuid REFERENCES seguridad.usuarios(id_usuario),
                                        aprobado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                        fecha_aprobacion      timestamp,
                                        fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                        fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                        UNIQUE(prefijo, numero_orden)
);

CREATE TABLE compras.detalles_orden_compra (
                                               id_detalle_orden_compra uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                               id_orden_compra       uuid NOT NULL REFERENCES compras.ordenes_compra(id_orden_compra) ON DELETE CASCADE,
                                               id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                               id_producto_embalaje  uuid REFERENCES maestros.productos_embalajes(id_producto_embalaje),
                                               cantidad              numeric(18,4) NOT NULL CHECK (cantidad > 0),
                                               cantidad_recibida     numeric(18,4) NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
                                               costo_unitario        numeric(18,6) NOT NULL CHECK (costo_unitario >= 0),
                                               porcentaje_descuento  numeric(8,4) NOT NULL DEFAULT 0,
                                               porcentaje_impuesto   numeric(8,4) NOT NULL DEFAULT 0,
                                               subtotal              numeric(18,2) NOT NULL DEFAULT 0,
                                               total                 numeric(18,2) NOT NULL DEFAULT 0,
                                               observaciones         text,
                                               fecha_creacion        timestamp NOT NULL DEFAULT now()
);

CREATE TABLE compras.recepciones_compra (
                                            id_recepcion_compra   uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                            prefijo               varchar(20),
                                            numero_recepcion      varchar(50) NOT NULL,
                                            id_orden_compra       uuid REFERENCES compras.ordenes_compra(id_orden_compra),
                                            id_proveedor          uuid NOT NULL REFERENCES maestros.terceros(id_tercero),
                                            id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                            estado                varchar(20) NOT NULL CHECK (estado IN ('BORRADOR','PENDIENTE_VALIDACION','VALIDADA','APLICADA','ANULADA','RECHAZADA')),
                                            fecha_recepcion       timestamp NOT NULL DEFAULT now(),
                                            recibido_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                            validado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                            fecha_validacion      timestamp,
                                            numero_factura_proveedor varchar(80),
                                            observaciones         text,
                                            fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                            fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                            UNIQUE(prefijo, numero_recepcion)
);

CREATE TABLE compras.detalles_recepcion_compra (
                                                   id_detalle_recepcion_compra uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                   id_recepcion_compra   uuid NOT NULL REFERENCES compras.recepciones_compra(id_recepcion_compra) ON DELETE CASCADE,
                                                   id_detalle_orden_compra uuid REFERENCES compras.detalles_orden_compra(id_detalle_orden_compra),
                                                   id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                   id_ubicacion          uuid REFERENCES inventario.ubicaciones(id_ubicacion),
                                                   id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                   cantidad_recibida     numeric(18,4) NOT NULL CHECK (cantidad_recibida > 0),
                                                   cantidad_aceptada     numeric(18,4) NOT NULL DEFAULT 0 CHECK (cantidad_aceptada >= 0),
                                                   cantidad_rechazada    numeric(18,4) NOT NULL DEFAULT 0 CHECK (cantidad_rechazada >= 0),
                                                   costo_unitario        numeric(18,6) NOT NULL CHECK (costo_unitario >= 0),
                                                   porcentaje_impuesto   numeric(8,4) NOT NULL DEFAULT 0,
                                                   fecha_vencimiento     date,
                                                   observaciones         text,
                                                   fecha_creacion        timestamp NOT NULL DEFAULT now()
);

CREATE TABLE compras.facturas_compra (
                                         id_factura_compra     uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                         id_proveedor          uuid NOT NULL REFERENCES maestros.terceros(id_tercero),
                                         id_orden_compra       uuid REFERENCES compras.ordenes_compra(id_orden_compra),
                                         id_recepcion_compra   uuid REFERENCES compras.recepciones_compra(id_recepcion_compra),
                                         tipo_documento        varchar(30) NOT NULL CHECK (tipo_documento IN ('FACTURA_ELECTRONICA','DOCUMENTO_SOPORTE','NOTA_DEBITO','NOTA_CREDITO','OTRO')),
                                         prefijo               varchar(20),
                                         numero_documento      varchar(60) NOT NULL,
                                         cufe_cuds             varchar(200),
                                         fecha_emision         timestamp NOT NULL,
                                         fecha_vencimiento     date,
                                         subtotal              numeric(18,2) NOT NULL DEFAULT 0,
                                         total_descuento       numeric(18,2) NOT NULL DEFAULT 0,
                                         total_impuestos       numeric(18,2) NOT NULL DEFAULT 0,
                                         total_general         numeric(18,2) NOT NULL DEFAULT 0,
                                         moneda                varchar(10) NOT NULL DEFAULT 'COP',
                                         estado                varchar(20) NOT NULL CHECK (estado IN ('REGISTRADA','VALIDADA','ANULADA','PAGADA','PARCIAL')),
                                         xml_dian_url          text,
                                         pdf_url               text,
                                         hash_documento        text,
                                         observaciones         text,
                                         fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                         fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                         UNIQUE(tipo_documento, prefijo, numero_documento, id_proveedor)
);

CREATE TABLE compras.devoluciones_proveedor (
                                                id_devolucion_proveedor uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                codigo                varchar(50) NOT NULL UNIQUE,
                                                id_proveedor          uuid NOT NULL REFERENCES maestros.terceros(id_tercero),
                                                id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                                id_recepcion_compra   uuid REFERENCES compras.recepciones_compra(id_recepcion_compra),
                                                estado                varchar(20) NOT NULL CHECK (estado IN ('BORRADOR','APROBADA','DESPACHADA','CERRADA','ANULADA')),
                                                motivo                varchar(180) NOT NULL,
                                                observaciones         text,
                                                fecha_documento       timestamp NOT NULL DEFAULT now(),
                                                creado_por            uuid REFERENCES seguridad.usuarios(id_usuario),
                                                aprobado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                                fecha_aprobacion      timestamp,
                                                fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE compras.detalles_devolucion_proveedor (
                                                       id_detalle_devolucion_proveedor uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                       id_devolucion_proveedor uuid NOT NULL REFERENCES compras.devoluciones_proveedor(id_devolucion_proveedor) ON DELETE CASCADE,
                                                       id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                       id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                       cantidad              numeric(18,4) NOT NULL CHECK (cantidad > 0),
                                                       costo_unitario        numeric(18,6) NOT NULL DEFAULT 0,
                                                       motivo_detalle        varchar(180),
                                                       observaciones         text,
                                                       fecha_creacion        timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- VENTAS / CLIENTES / POS / ECOMMERCE
-- =========================================================
CREATE TABLE ventas.clientes (
                                 id_cliente            uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                 id_tercero            uuid UNIQUE REFERENCES maestros.terceros(id_tercero) ON DELETE CASCADE,
                                 fecha_nacimiento      date,
                                 acepta_marketing      boolean NOT NULL DEFAULT false,
                                 validado_mayor_edad   boolean NOT NULL DEFAULT false,
                                 fecha_validacion_edad timestamp,
                                 canal_registro        varchar(40),
                                 puntaje_riesgo        numeric(10,4),
                                 activo                boolean NOT NULL DEFAULT true,
                                 fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                 fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ventas.direcciones_cliente (
                                            id_direccion_cliente  uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                            id_cliente            uuid NOT NULL REFERENCES ventas.clientes(id_cliente) ON DELETE CASCADE,
                                            id_pais               uuid REFERENCES maestros.paises(id_pais),
                                            id_departamento       uuid REFERENCES maestros.departamentos(id_departamento),
                                            id_ciudad             uuid REFERENCES maestros.ciudades(id_ciudad),
                                            direccion_linea_1     varchar(255) NOT NULL,
                                            direccion_linea_2     varchar(255),
                                            codigo_postal         varchar(20),
                                            es_principal          boolean NOT NULL DEFAULT false,
                                            tipo_direccion        varchar(30) NOT NULL CHECK (tipo_direccion IN ('FACTURACION','ENVIO','OTRA')),
                                            fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                            fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ventas.metodos_pago (
                                     id_metodo_pago        uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                     codigo                varchar(30) NOT NULL UNIQUE,
                                     nombre                varchar(100) NOT NULL UNIQUE,
                                     tipo_metodo           varchar(30) NOT NULL CHECK (tipo_metodo IN ('EFECTIVO','TARJETA','TRANSFERENCIA','PSE','NEQUI','DAVIPLATA','CREDITO','OTRO')),
                                     activo                boolean NOT NULL DEFAULT true,
                                     fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                     fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ventas.cajas_punto_venta (
                                          id_caja_punto_venta   uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                          codigo                varchar(30) NOT NULL UNIQUE,
                                          nombre                varchar(120) NOT NULL,
                                          id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                          id_canal_venta        uuid REFERENCES maestros.canales_venta(id_canal_venta),
                                          activa                boolean NOT NULL DEFAULT true,
                                          fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                          fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ventas.ventas (
                               id_venta              uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                               prefijo               varchar(20),
                               numero_venta          varchar(60) NOT NULL,
                               tipo_venta            varchar(30) NOT NULL CHECK (tipo_venta IN ('POS','ECOMMERCE','MARKETPLACE','MAYORISTA','MANUAL')),
                               id_cliente            uuid REFERENCES ventas.clientes(id_cliente),
                               id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                               id_caja_punto_venta   uuid REFERENCES ventas.cajas_punto_venta(id_caja_punto_venta),
                               id_canal_venta        uuid REFERENCES maestros.canales_venta(id_canal_venta),
                               estado                varchar(20) NOT NULL CHECK (estado IN ('BORRADOR','CONFIRMADA','FACTURADA','DESPACHADA','ENTREGADA','ANULADA','DEVUELTA','PARCIAL_DEVUELTA')),
                               fecha_venta           timestamp NOT NULL DEFAULT now(),
                               subtotal              numeric(18,2) NOT NULL DEFAULT 0,
                               total_descuento       numeric(18,2) NOT NULL DEFAULT 0,
                               total_impuestos       numeric(18,2) NOT NULL DEFAULT 0,
                               total_general         numeric(18,2) NOT NULL DEFAULT 0,
                               observaciones         text,
                               control_mayoria_edad_requerido boolean NOT NULL DEFAULT false,
                               control_mayoria_edad_realizado boolean NOT NULL DEFAULT false,
                               fecha_control_mayoria_edad timestamp,
                               creado_por            uuid REFERENCES seguridad.usuarios(id_usuario),
                               fecha_creacion        timestamp NOT NULL DEFAULT now(),
                               fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                               UNIQUE(prefijo, numero_venta)
);

CREATE TABLE ventas.detalles_venta (
                                       id_detalle_venta      uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                       id_venta              uuid NOT NULL REFERENCES ventas.ventas(id_venta) ON DELETE CASCADE,
                                       id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                       id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                       id_producto_embalaje  uuid REFERENCES maestros.productos_embalajes(id_producto_embalaje),
                                       cantidad              numeric(18,4) NOT NULL CHECK (cantidad > 0),
                                       precio_unitario       numeric(18,2) NOT NULL CHECK (precio_unitario >= 0),
                                       porcentaje_descuento  numeric(8,4) NOT NULL DEFAULT 0,
                                       porcentaje_impuesto   numeric(8,4) NOT NULL DEFAULT 0,
                                       subtotal              numeric(18,2) NOT NULL DEFAULT 0,
                                       total                 numeric(18,2) NOT NULL DEFAULT 0,
                                       requiere_control_mayoria_edad boolean NOT NULL DEFAULT false,
                                       observaciones         text,
                                       fecha_creacion        timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ventas.pagos_venta (
                                    id_pago_venta         uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                    id_venta              uuid NOT NULL REFERENCES ventas.ventas(id_venta) ON DELETE CASCADE,
                                    id_metodo_pago        uuid NOT NULL REFERENCES ventas.metodos_pago(id_metodo_pago),
                                    valor_pagado          numeric(18,2) NOT NULL CHECK (valor_pagado >= 0),
                                    referencia_pago       varchar(120),
                                    fecha_pago            timestamp NOT NULL DEFAULT now(),
                                    aprobado              boolean NOT NULL DEFAULT true,
                                    observaciones         text,
                                    fecha_creacion        timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ventas.facturas_venta (
                                       id_factura_venta      uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                       id_venta              uuid NOT NULL UNIQUE REFERENCES ventas.ventas(id_venta) ON DELETE CASCADE,
                                       tipo_documento        varchar(30) NOT NULL CHECK (tipo_documento IN ('FACTURA_ELECTRONICA','DOCUMENTO_EQUIVALENTE','NOTA_CREDITO','NOTA_DEBITO')),
                                       prefijo               varchar(20),
                                       numero_documento      varchar(60) NOT NULL,
                                       cufe_cuds             varchar(200),
                                       fecha_emision         timestamp NOT NULL DEFAULT now(),
                                       subtotal              numeric(18,2) NOT NULL DEFAULT 0,
                                       total_descuento       numeric(18,2) NOT NULL DEFAULT 0,
                                       total_impuestos       numeric(18,2) NOT NULL DEFAULT 0,
                                       total_general         numeric(18,2) NOT NULL DEFAULT 0,
                                       estado_dian           varchar(30) NOT NULL CHECK (estado_dian IN ('PENDIENTE','ACEPTADA','RECHAZADA','ANULADA')),
                                       xml_dian_url          text,
                                       pdf_url               text,
                                       hash_documento        text,
                                       observaciones         text,
                                       fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                       fecha_actualizacion   timestamp NOT NULL DEFAULT now(),
                                       UNIQUE(prefijo, numero_documento)
);

CREATE TABLE ventas.pedidos_ecommerce (
                                          id_pedido_ecommerce   uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                          codigo_pedido         varchar(80) NOT NULL UNIQUE,
                                          id_cliente            uuid REFERENCES ventas.clientes(id_cliente),
                                          id_canal_venta        uuid REFERENCES maestros.canales_venta(id_canal_venta),
                                          id_bodega_despacho    uuid REFERENCES inventario.bodegas(id_bodega),
                                          estado                varchar(30) NOT NULL CHECK (estado IN ('RECIBIDO','PAGADO','RESERVADO','ALISTADO','DESPACHADO','ENTREGADO','CANCELADO','DEVUELTO')),
                                          fecha_pedido          timestamp NOT NULL DEFAULT now(),
                                          subtotal              numeric(18,2) NOT NULL DEFAULT 0,
                                          total_descuento       numeric(18,2) NOT NULL DEFAULT 0,
                                          total_impuestos       numeric(18,2) NOT NULL DEFAULT 0,
                                          costo_envio           numeric(18,2) NOT NULL DEFAULT 0,
                                          total_general         numeric(18,2) NOT NULL DEFAULT 0,
                                          numero_guia           varchar(120),
                                          transportadora        varchar(120),
                                          observaciones         text,
                                          referencia_externa    varchar(120),
                                          control_mayoria_edad_requerido boolean NOT NULL DEFAULT false,
                                          control_mayoria_edad_realizado boolean NOT NULL DEFAULT false,
                                          fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                          fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ventas.detalles_pedido_ecommerce (
                                                  id_detalle_pedido_ecommerce uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                  id_pedido_ecommerce   uuid NOT NULL REFERENCES ventas.pedidos_ecommerce(id_pedido_ecommerce) ON DELETE CASCADE,
                                                  id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                  cantidad              numeric(18,4) NOT NULL CHECK (cantidad > 0),
                                                  precio_unitario       numeric(18,2) NOT NULL CHECK (precio_unitario >= 0),
                                                  porcentaje_descuento  numeric(8,4) NOT NULL DEFAULT 0,
                                                  porcentaje_impuesto   numeric(8,4) NOT NULL DEFAULT 0,
                                                  subtotal              numeric(18,2) NOT NULL DEFAULT 0,
                                                  total                 numeric(18,2) NOT NULL DEFAULT 0,
                                                  requiere_control_mayoria_edad boolean NOT NULL DEFAULT false,
                                                  fecha_creacion        timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ventas.devoluciones_cliente (
                                             id_devolucion_cliente uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                             codigo                varchar(50) NOT NULL UNIQUE,
                                             id_venta              uuid REFERENCES ventas.ventas(id_venta),
                                             id_pedido_ecommerce   uuid REFERENCES ventas.pedidos_ecommerce(id_pedido_ecommerce),
                                             id_cliente            uuid REFERENCES ventas.clientes(id_cliente),
                                             id_bodega_recepcion   uuid REFERENCES inventario.bodegas(id_bodega),
                                             tipo_devolucion       varchar(30) NOT NULL CHECK (tipo_devolucion IN ('GARANTIA','RETRACTO','CAMBIO_COMERCIAL','NO_CONFORMIDAD','OTRO')),
                                             estado                varchar(20) NOT NULL CHECK (estado IN ('RADICADA','EN_REVISION','APROBADA','RECHAZADA','CERRADA','ANULADA')),
                                             motivo                varchar(180) NOT NULL,
                                             descripcion_caso      text,
                                             evidencia_url         text,
                                             fecha_radicacion      timestamp NOT NULL DEFAULT now(),
                                             fecha_resolucion      timestamp,
                                             resuelto_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                             observaciones         text,
                                             fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                             fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ventas.detalles_devolucion_cliente (
                                                    id_detalle_devolucion_cliente uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                    id_devolucion_cliente uuid NOT NULL REFERENCES ventas.devoluciones_cliente(id_devolucion_cliente) ON DELETE CASCADE,
                                                    id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                    id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                    cantidad              numeric(18,4) NOT NULL CHECK (cantidad > 0),
                                                    estado_producto_recibido varchar(40) NOT NULL CHECK (estado_producto_recibido IN ('NUEVO','ABIERTO','USADO','DANADO','INCOMPLETO','OTRO')),
                                                    decision_final        varchar(30) CHECK (decision_final IN ('REINTEGRA_STOCK','CUARENTENA','DESECHO','REEMPLAZO','NOTA_CREDITO','REEMBOLSO')),
                                                    observaciones         text,
                                                    fecha_creacion        timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- CUMPLIMIENTO / PRIVACIDAD / MAYORÍA DE EDAD
-- =========================================================
CREATE TABLE cumplimiento.politicas_tratamiento_datos (
                                                          id_politica_tratamiento_datos uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                          version               varchar(30) NOT NULL UNIQUE,
                                                          titulo                varchar(180) NOT NULL,
                                                          url_documento         text,
                                                          fecha_inicio_vigencia date NOT NULL,
                                                          fecha_fin_vigencia    date,
                                                          activa                boolean NOT NULL DEFAULT true,
                                                          fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                          fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE cumplimiento.autorizaciones_datos_personales (
                                                              id_autorizacion_datos_personales uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                              id_tercero            uuid NOT NULL REFERENCES maestros.terceros(id_tercero),
                                                              id_politica_tratamiento_datos uuid REFERENCES cumplimiento.politicas_tratamiento_datos(id_politica_tratamiento_datos),
                                                              canal                 varchar(40) NOT NULL CHECK (canal IN ('WEB','POS','TELEFONO','CORREO','WHATSAPP','OTRO')),
                                                              finalidad             text NOT NULL,
                                                              autorizada            boolean NOT NULL,
                                                              fecha_autorizacion    timestamp NOT NULL DEFAULT now(),
                                                              evidencia             text,
                                                              ip_origen             inet,
                                                              revocada              boolean NOT NULL DEFAULT false,
                                                              fecha_revocatoria     timestamp,
                                                              observaciones         text,
                                                              fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                              fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE cumplimiento.solicitudes_habeas_data (
                                                      id_solicitud_habeas_data uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                      id_tercero            uuid NOT NULL REFERENCES maestros.terceros(id_tercero),
                                                      tipo_solicitud        varchar(30) NOT NULL CHECK (tipo_solicitud IN ('CONSULTA','ACTUALIZACION','RECTIFICACION','SUPRESION','REVOCATORIA')),
                                                      estado                varchar(20) NOT NULL CHECK (estado IN ('RADICADA','EN_TRAMITE','RESPONDIDA','CERRADA','RECHAZADA')),
                                                      fecha_radicacion      timestamp NOT NULL DEFAULT now(),
                                                      fecha_respuesta       timestamp,
                                                      descripcion           text NOT NULL,
                                                      respuesta             text,
                                                      responsable_id_usuario uuid REFERENCES seguridad.usuarios(id_usuario),
                                                      observaciones         text,
                                                      fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                      fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE cumplimiento.validaciones_mayoria_edad (
                                                        id_validacion_mayoria_edad uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                        id_cliente            uuid REFERENCES ventas.clientes(id_cliente),
                                                        id_venta              uuid REFERENCES ventas.ventas(id_venta),
                                                        id_pedido_ecommerce   uuid REFERENCES ventas.pedidos_ecommerce(id_pedido_ecommerce),
                                                        metodo_validacion     varchar(40) NOT NULL CHECK (metodo_validacion IN ('DOCUMENTO','PASARELA','CHECKBOX_DECLARATIVO','VALIDACION_MANUAL','OTRO')),
                                                        resultado             varchar(20) NOT NULL CHECK (resultado IN ('APROBADO','RECHAZADO','PENDIENTE')),
                                                        evidencia             text,
                                                        fecha_validacion      timestamp NOT NULL DEFAULT now(),
                                                        validado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                                        observaciones         text,
                                                        fecha_creacion        timestamp NOT NULL DEFAULT now()
);

CREATE TABLE cumplimiento.alertas_regulatorias (
                                                   id_alerta_regulatoria uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                   id_producto           uuid REFERENCES maestros.productos(id_producto),
                                                   id_lote_producto      uuid REFERENCES inventario.lotes_producto(id_lote_producto),
                                                   tipo_alerta           varchar(40) NOT NULL CHECK (tipo_alerta IN ('REGISTRO_VENCIDO','LOTE_VENCIDO','ALERTA_SANITARIA','DOCUMENTO_FALTANTE','PRODUCTO_RESTRINGIDO','OTRO')),
                                                   severidad             varchar(20) NOT NULL CHECK (severidad IN ('BAJA','MEDIA','ALTA','CRITICA')),
                                                   estado                varchar(20) NOT NULL CHECK (estado IN ('ACTIVA','EN_REVISION','RESUELTA','CERRADA')),
                                                   titulo                varchar(180) NOT NULL,
                                                   descripcion           text,
                                                   fecha_alerta          timestamp NOT NULL DEFAULT now(),
                                                   fecha_cierre          timestamp,
                                                   responsable_id_usuario uuid REFERENCES seguridad.usuarios(id_usuario),
                                                   observaciones         text,
                                                   fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                   fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- APROBACIONES / FLUJOS
-- =========================================================
CREATE TABLE auditoria.flujos_aprobacion (
                                             id_flujo_aprobacion   uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                             codigo                varchar(50) NOT NULL UNIQUE,
                                             nombre                varchar(120) NOT NULL,
                                             tipo_documento        varchar(50) NOT NULL,
                                             descripcion           text,
                                             activo                boolean NOT NULL DEFAULT true,
                                             fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                             fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE auditoria.niveles_flujo_aprobacion (
                                                    id_nivel_flujo_aprobacion uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                    id_flujo_aprobacion   uuid NOT NULL REFERENCES auditoria.flujos_aprobacion(id_flujo_aprobacion) ON DELETE CASCADE,
                                                    nivel                 integer NOT NULL CHECK (nivel > 0),
                                                    nombre                varchar(120) NOT NULL,
                                                    id_rol_requerido      uuid REFERENCES seguridad.roles(id_rol),
                                                    monto_minimo          numeric(18,2),
                                                    monto_maximo          numeric(18,2),
                                                    obligatorio           boolean NOT NULL DEFAULT true,
                                                    fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                    UNIQUE(id_flujo_aprobacion, nivel)
);

CREATE TABLE auditoria.solicitudes_aprobacion (
                                                  id_solicitud_aprobacion uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                  id_flujo_aprobacion   uuid NOT NULL REFERENCES auditoria.flujos_aprobacion(id_flujo_aprobacion),
                                                  tipo_documento        varchar(50) NOT NULL,
                                                  id_documento          uuid NOT NULL,
                                                  estado                varchar(20) NOT NULL CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA','ANULADA')),
                                                  monto_referencia      numeric(18,2),
                                                  solicitada_por        uuid REFERENCES seguridad.usuarios(id_usuario),
                                                  fecha_solicitud       timestamp NOT NULL DEFAULT now(),
                                                  observaciones         text,
                                                  fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                  fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE auditoria.respuestas_aprobacion (
                                                 id_respuesta_aprobacion uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                 id_solicitud_aprobacion uuid NOT NULL REFERENCES auditoria.solicitudes_aprobacion(id_solicitud_aprobacion) ON DELETE CASCADE,
                                                 id_nivel_flujo_aprobacion uuid NOT NULL REFERENCES auditoria.niveles_flujo_aprobacion(id_nivel_flujo_aprobacion),
                                                 id_usuario_aprobador  uuid REFERENCES seguridad.usuarios(id_usuario),
                                                 decision              varchar(20) NOT NULL CHECK (decision IN ('APROBADO','RECHAZADO','PENDIENTE')),
                                                 fecha_decision        timestamp,
                                                 observaciones         text,
                                                 fecha_creacion        timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- ALERTAS OPERATIVAS
-- =========================================================
CREATE TABLE auditoria.alertas_operativas (
                                              id_alerta_operativa   uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                              modulo                varchar(50) NOT NULL,
                                              tipo_alerta           varchar(50) NOT NULL,
                                              severidad             varchar(20) NOT NULL CHECK (severidad IN ('BAJA','MEDIA','ALTA','CRITICA')),
                                              estado                varchar(20) NOT NULL CHECK (estado IN ('ACTIVA','ATENDIDA','CERRADA','ANULADA')),
                                              titulo                varchar(180) NOT NULL,
                                              descripcion           text,
                                              id_entidad_relacionada uuid,
                                              nombre_tabla_relacionada varchar(120),
                                              fecha_generacion      timestamp NOT NULL DEFAULT now(),
                                              fecha_atencion        timestamp,
                                              atendida_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                              observaciones         text,
                                              fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                              fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- AUDITORÍA GENERAL
-- =========================================================
CREATE TABLE auditoria.eventos_auditoria (
                                             id_evento_auditoria   uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                             modulo                varchar(60) NOT NULL,
                                             nombre_tabla          varchar(120) NOT NULL,
                                             id_registro           uuid,
                                             tipo_evento           varchar(20) NOT NULL CHECK (tipo_evento IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','APROBACION','RECHAZO','ANULACION','OTRO')),
                                             descripcion           text,
                                             valor_anterior        jsonb,
                                             valor_nuevo           jsonb,
                                             id_usuario            uuid REFERENCES seguridad.usuarios(id_usuario),
                                             direccion_ip          inet,
                                             agente_usuario        text,
                                             fecha_evento          timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- INTEGRACIONES / DIAN / EXTERNOS
-- =========================================================
CREATE TABLE integraciones.sistemas_externos (
                                                 id_sistema_externo    uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                 codigo                varchar(50) NOT NULL UNIQUE,
                                                 nombre                varchar(120) NOT NULL,
                                                 tipo_sistema          varchar(50) NOT NULL CHECK (tipo_sistema IN ('DIAN','ECOMMERCE','MARKETPLACE','ERP','WMS','PASARELA_PAGO','OTRO')),
                                                 url_base              text,
                                                 activo                boolean NOT NULL DEFAULT true,
                                                 fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                 fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE integraciones.sincronizaciones (
                                                id_sincronizacion     uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                id_sistema_externo    uuid NOT NULL REFERENCES integraciones.sistemas_externos(id_sistema_externo),
                                                modulo                varchar(60) NOT NULL,
                                                tipo_operacion        varchar(20) NOT NULL CHECK (tipo_operacion IN ('IMPORTACION','EXPORTACION','SINCRONIZACION')),
                                                id_registro_local     uuid,
                                                id_registro_externo   varchar(120),
                                                estado                varchar(20) NOT NULL CHECK (estado IN ('PENDIENTE','EXITOSA','FALLIDA','REINTENTO')),
                                                fecha_ejecucion       timestamp NOT NULL DEFAULT now(),
                                                mensaje_resultado     text,
                                                payload_enviado       jsonb,
                                                payload_recibido      jsonb,
                                                fecha_creacion        timestamp NOT NULL DEFAULT now(),
                                                fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

-- =========================================================
-- IA MÍNIMA VIABLE
-- =========================================================
CREATE TABLE ia.modelos_ia (
                               id_modelo_ia          uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                               codigo                varchar(50) NOT NULL UNIQUE,
                               nombre                varchar(120) NOT NULL,
                               tipo_modelo           varchar(40) NOT NULL CHECK (tipo_modelo IN ('PRONOSTICO_DEMANDA','REPOSICION','ANOMALIAS','CLASIFICACION','EXTRACCION_DOCUMENTOS')),
                               version               varchar(50) NOT NULL,
                               descripcion           text,
                               activo                boolean NOT NULL DEFAULT true,
                               fecha_entrenamiento   timestamp,
                               parametros            jsonb,
                               metricas              jsonb,
                               fecha_creacion        timestamp NOT NULL DEFAULT now(),
                               fecha_actualizacion   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ia.pronosticos_demanda (
                                        id_pronostico_demanda uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                        id_modelo_ia          uuid REFERENCES ia.modelos_ia(id_modelo_ia),
                                        id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                        id_bodega             uuid REFERENCES inventario.bodegas(id_bodega),
                                        periodo_desde         date NOT NULL,
                                        periodo_hasta         date NOT NULL,
                                        demanda_estimada      numeric(18,4) NOT NULL CHECK (demanda_estimada >= 0),
                                        intervalo_inferior    numeric(18,4),
                                        intervalo_superior    numeric(18,4),
                                        nivel_confianza       numeric(8,4),
                                        variables_utilizadas  jsonb,
                                        generado_en           timestamp NOT NULL DEFAULT now(),
                                        generado_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                        observaciones         text
);

CREATE TABLE ia.recomendaciones_reposicion (
                                               id_recomendacion_reposicion uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                               id_modelo_ia          uuid REFERENCES ia.modelos_ia(id_modelo_ia),
                                               id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                               id_bodega             uuid NOT NULL REFERENCES inventario.bodegas(id_bodega),
                                               fecha_recomendacion   timestamp NOT NULL DEFAULT now(),
                                               cantidad_sugerida     numeric(18,4) NOT NULL CHECK (cantidad_sugerida >= 0),
                                               tipo_recomendacion    varchar(30) NOT NULL CHECK (tipo_recomendacion IN ('COMPRA','TRASLADO','PRODUCCION','NINGUNA')),
                                               justificacion         text,
                                               datos_base            jsonb,
                                               atendida              boolean NOT NULL DEFAULT false,
                                               atendida_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                               fecha_atencion        timestamp
);

CREATE TABLE ia.anomalias_inventario (
                                         id_anomalia_inventario uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                         id_modelo_ia          uuid REFERENCES ia.modelos_ia(id_modelo_ia),
                                         id_producto           uuid REFERENCES maestros.productos(id_producto),
                                         id_bodega             uuid REFERENCES inventario.bodegas(id_bodega),
                                         tipo_anomalia         varchar(50) NOT NULL CHECK (tipo_anomalia IN ('MERMA_ATIPICA','VENTA_ATIPICA','AJUSTE_REPETITIVO','QUIEBRE_REPETIDO','SOBRESTOCK','OTRO')),
                                         severidad             varchar(20) NOT NULL CHECK (severidad IN ('BAJA','MEDIA','ALTA','CRITICA')),
                                         puntaje_anomalia      numeric(12,6),
                                         descripcion           text,
                                         evidencia_datos       jsonb,
                                         estado                varchar(20) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','EN_REVISION','DESCARTADA','CONFIRMADA','CERRADA')),
                                         detectada_en          timestamp NOT NULL DEFAULT now(),
                                         cerrada_en            timestamp,
                                         responsable_id_usuario uuid REFERENCES seguridad.usuarios(id_usuario)
);

CREATE TABLE ia.sugerencias_clasificacion_producto (
                                                       id_sugerencia_clasificacion_producto uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                                       id_modelo_ia          uuid REFERENCES ia.modelos_ia(id_modelo_ia),
                                                       id_producto           uuid NOT NULL REFERENCES maestros.productos(id_producto),
                                                       id_categoria_sugerida uuid REFERENCES maestros.categorias_producto(id_categoria_producto),
                                                       etiquetas_sugeridas   jsonb,
                                                       atributos_sugeridos   jsonb,
                                                       puntaje_confianza     numeric(8,4),
                                                       aceptada              boolean,
                                                       aceptada_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                                       fecha_revision        timestamp,
                                                       generado_en           timestamp NOT NULL DEFAULT now()
);

CREATE TABLE ia.extracciones_documento (
                                           id_extraccion_documento uuid PRIMARY KEY DEFAULT maestros.generar_uuid(),
                                           id_modelo_ia          uuid REFERENCES ia.modelos_ia(id_modelo_ia),
                                           tipo_documento        varchar(50) NOT NULL CHECK (tipo_documento IN ('FACTURA_COMPRA','LISTA_EMPAQUE','FICHA_TECNICA','REGISTRO_SANITARIO','OTRO')),
                                           nombre_archivo        varchar(255),
                                           url_archivo           text NOT NULL,
                                           hash_archivo          text,
                                           campos_extraidos      jsonb NOT NULL,
                                           porcentaje_confianza  numeric(8,4),
                                           validada              boolean NOT NULL DEFAULT false,
                                           validada_por          uuid REFERENCES seguridad.usuarios(id_usuario),
                                           fecha_validacion      timestamp,
                                           generado_en           timestamp NOT NULL DEFAULT now(),
                                           observaciones         text
);

-- =========================================================
-- VISTAS DE APOYO
-- =========================================================
CREATE OR REPLACE VIEW inventario.v_stock_actual AS
SELECT
    e.id_producto,
    p.sku,
    p.nombre AS nombre_producto,
    e.id_bodega,
    b.codigo AS codigo_bodega,
    b.nombre AS nombre_bodega,
    e.id_ubicacion,
    u.codigo AS codigo_ubicacion,
    e.id_lote_producto,
    l.numero_lote,
    e.cantidad_disponible,
    e.cantidad_reservada,
    e.cantidad_bloqueada,
    e.cantidad_transito_entrada,
    e.cantidad_transito_salida,
    (e.cantidad_disponible - e.cantidad_reservada - e.cantidad_bloqueada) AS cantidad_vendible,
    e.costo_promedio,
    e.fecha_actualizacion
FROM inventario.existencias e
         JOIN maestros.productos p ON p.id_producto = e.id_producto
         JOIN inventario.bodegas b ON b.id_bodega = e.id_bodega
         LEFT JOIN inventario.ubicaciones u ON u.id_ubicacion = e.id_ubicacion
         LEFT JOIN inventario.lotes_producto l ON l.id_lote_producto = e.id_lote_producto;

CREATE OR REPLACE VIEW inventario.v_productos_stock_bajo AS
SELECT
    p.id_producto,
    p.sku,
    p.nombre,
    b.id_bodega,
    b.codigo AS codigo_bodega,
    b.nombre AS nombre_bodega,
    p.stock_minimo,
    COALESCE(SUM(e.cantidad_disponible - e.cantidad_reservada - e.cantidad_bloqueada), 0) AS stock_vendible
FROM maestros.productos p
         CROSS JOIN inventario.bodegas b
         LEFT JOIN inventario.existencias e
                   ON e.id_producto = p.id_producto
                       AND e.id_bodega = b.id_bodega
WHERE p.activo = true
  AND b.activa = true
GROUP BY p.id_producto, p.sku, p.nombre, b.id_bodega, b.codigo, b.nombre, p.stock_minimo
HAVING COALESCE(SUM(e.cantidad_disponible - e.cantidad_reservada - e.cantidad_bloqueada), 0) <= p.stock_minimo;

CREATE OR REPLACE VIEW inventario.v_lotes_por_vencer AS
SELECT
    l.id_lote_producto,
    p.id_producto,
    p.sku,
    p.nombre,
    l.numero_lote,
    l.fecha_vencimiento,
    (l.fecha_vencimiento - current_date) AS dias_para_vencer,
    e.id_bodega,
    b.nombre AS nombre_bodega,
    SUM(e.cantidad_disponible) AS cantidad_disponible
FROM inventario.lotes_producto l
         JOIN maestros.productos p ON p.id_producto = l.id_producto
         LEFT JOIN inventario.existencias e ON e.id_lote_producto = l.id_lote_producto
         LEFT JOIN inventario.bodegas b ON b.id_bodega = e.id_bodega
WHERE l.fecha_vencimiento IS NOT NULL
GROUP BY l.id_lote_producto, p.id_producto, p.sku, p.nombre, l.numero_lote, l.fecha_vencimiento, e.id_bodega, b.nombre;

CREATE OR REPLACE VIEW inventario.v_kardex AS
SELECT
    mi.id_movimiento_inventario,
    dmi.tipo_documento,
    dmi.numero_documento,
    mi.fecha_movimiento,
    p.sku,
    p.nombre AS nombre_producto,
    b.nombre AS nombre_bodega,
    u.codigo AS codigo_ubicacion,
    l.numero_lote,
    tmi.codigo AS codigo_tipo_movimiento,
    tmi.nombre AS nombre_tipo_movimiento,
    mi.signo,
    mi.cantidad,
    (mi.cantidad * mi.signo) AS cantidad_neta,
    mi.costo_unitario,
    mi.valor_total,
    mi.saldo_cantidad_anterior,
    mi.saldo_cantidad_nuevo,
    mi.saldo_valor_anterior,
    mi.saldo_valor_nuevo,
    mi.detalle
FROM inventario.movimientos_inventario mi
         JOIN inventario.documentos_movimiento_inventario dmi
              ON dmi.id_documento_movimiento_inventario = mi.id_documento_movimiento_inventario
         JOIN inventario.tipos_movimiento_inventario tmi
              ON tmi.id_tipo_movimiento_inventario = mi.id_tipo_movimiento_inventario
         JOIN maestros.productos p
              ON p.id_producto = mi.id_producto
         JOIN inventario.bodegas b
              ON b.id_bodega = mi.id_bodega
         LEFT JOIN inventario.ubicaciones u
                   ON u.id_ubicacion = mi.id_ubicacion
         LEFT JOIN inventario.lotes_producto l
                   ON l.id_lote_producto = mi.id_lote_producto;

-- =========================================================
-- TRIGGERS FECHA_ACTUALIZACION
-- =========================================================
DO $$
DECLARE
registro record;
BEGIN
FOR registro IN
SELECT c.table_schema, c.table_name
FROM information_schema.columns c
         JOIN information_schema.tables t
              ON t.table_schema = c.table_schema
                  AND t.table_name = c.table_name
WHERE c.column_name = 'fecha_actualizacion'
  AND t.table_type = 'BASE TABLE'
  AND c.table_schema IN ('seguridad','maestros','inventario','compras','ventas','cumplimiento','integraciones','ia','auditoria')
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_%I_fecha_actualizacion
             BEFORE UPDATE ON %I.%I
             FOR EACH ROW
             EXECUTE FUNCTION maestros.asignar_fechas_actualizacion();',
            registro.table_schema,
            registro.table_name,
            registro.table_schema,
            registro.table_name
        );
END LOOP;
END $$;

-- =========================================================
-- TRIGGERS CANTIDAD POSITIVA EN DETALLES
-- =========================================================
CREATE TRIGGER trg_detalle_solicitud_traslado_cantidad
    BEFORE INSERT OR UPDATE ON inventario.detalles_solicitud_traslado
                         FOR EACH ROW
                         EXECUTE FUNCTION inventario.validar_cantidad_positiva();

CREATE TRIGGER trg_detalle_transferencia_interna_cantidad
    BEFORE INSERT OR UPDATE ON inventario.detalles_transferencia_interna_ubicacion
                         FOR EACH ROW
                         EXECUTE FUNCTION inventario.validar_cantidad_positiva();

CREATE TRIGGER trg_detalle_orden_compra_cantidad
    BEFORE INSERT OR UPDATE ON compras.detalles_orden_compra
                         FOR EACH ROW
                         EXECUTE FUNCTION inventario.validar_cantidad_positiva();

CREATE TRIGGER trg_detalle_recepcion_compra_cantidad
    BEFORE INSERT OR UPDATE ON compras.detalles_recepcion_compra
                         FOR EACH ROW
                         EXECUTE FUNCTION inventario.validar_cantidad_positiva();

CREATE TRIGGER trg_detalle_devolucion_proveedor_cantidad
    BEFORE INSERT OR UPDATE ON compras.detalles_devolucion_proveedor
                         FOR EACH ROW
                         EXECUTE FUNCTION inventario.validar_cantidad_positiva();

CREATE TRIGGER trg_detalle_venta_cantidad
    BEFORE INSERT OR UPDATE ON ventas.detalles_venta
                         FOR EACH ROW
                         EXECUTE FUNCTION inventario.validar_cantidad_positiva();

CREATE TRIGGER trg_detalle_pedido_ecommerce_cantidad
    BEFORE INSERT OR UPDATE ON ventas.detalles_pedido_ecommerce
                         FOR EACH ROW
                         EXECUTE FUNCTION inventario.validar_cantidad_positiva();

CREATE TRIGGER trg_detalle_devolucion_cliente_cantidad
    BEFORE INSERT OR UPDATE ON ventas.detalles_devolucion_cliente
                         FOR EACH ROW
                         EXECUTE FUNCTION inventario.validar_cantidad_positiva();

-- =========================================================
-- DATOS INICIALES MÍNIMOS
-- =========================================================
INSERT INTO maestros.monedas (codigo, nombre, simbolo)
VALUES ('COP','Peso Colombiano','$')
    ON CONFLICT (codigo) DO NOTHING;

INSERT INTO maestros.paises (codigo_iso2, codigo_iso3, nombre)
VALUES ('CO','COL','Colombia')
    ON CONFLICT (codigo_iso2) DO NOTHING;

INSERT INTO maestros.tipos_documento_identidad (codigo, nombre, aplica_persona_natural, aplica_persona_juridica)
VALUES
    ('CC','Cédula de ciudadanía',true,false),
    ('CE','Cédula de extranjería',true,false),
    ('NIT','Número de identificación tributaria',false,true),
    ('PAS','Pasaporte',true,false)
    ON CONFLICT (codigo) DO NOTHING;

INSERT INTO maestros.unidades_medida (codigo, nombre)
VALUES
    ('UND','Unidad'),
    ('CJ','Caja'),
    ('PK','Paquete'),
    ('ML','Mililitro'),
    ('GR','Gramo')
    ON CONFLICT (codigo) DO NOTHING;

INSERT INTO maestros.tipos_impuesto (codigo, nombre)
VALUES
    ('IVA','Impuesto sobre las ventas'),
    ('INC','Impuesto nacional al consumo'),
    ('RET_FTE','Retención en la fuente')
    ON CONFLICT (codigo) DO NOTHING;

INSERT INTO maestros.canales_venta (codigo, nombre, tipo_canal)
VALUES
    ('TIENDA','Tienda física','TIENDA_FISICA'),
    ('WEB','Sitio web','ECOMMERCE'),
    ('MARKET','Marketplace','MARKETPLACE'),
    ('MAYORISTA','Mayorista','MAYORISTA')
    ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ventas.metodos_pago (codigo, nombre, tipo_metodo)
VALUES
    ('EFECTIVO','Efectivo','EFECTIVO'),
    ('TARJETA','Tarjeta','TARJETA'),
    ('TRANSFERENCIA','Transferencia','TRANSFERENCIA'),
    ('PSE','PSE','PSE'),
    ('NEQUI','Nequi','NEQUI'),
    ('DAVIPLATA','Daviplata','DAVIPLATA')
    ON CONFLICT (codigo) DO NOTHING;

COMMIT;
