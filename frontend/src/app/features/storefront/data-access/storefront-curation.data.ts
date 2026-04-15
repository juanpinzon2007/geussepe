export interface StorefrontCatalogSection {
  id: string;
  title: string;
  teaser: string;
  spotlight: string;
  items: string[];
}

export interface StorefrontTechnicalAttribute {
  label: string;
  detail: string;
}

export const STOREFRONT_CATALOG_SECTIONS: StorefrontCatalogSection[] = [
  {
    id: 'juguetes-sexuales',
    title: 'Juguetes sexuales',
    teaser: 'La base del catalogo para placer, fantasia y estimulacion inteligente.',
    spotlight: 'Desde vibradores discretos hasta juguetes para pareja.',
    items: [
      'Vibradores',
      'Bullet',
      'Rabbit',
      'Punto G',
      'Varita (wand)',
      'Succionadores tipo Satisfyer',
      'Dildos realistas',
      'Dildos fantasy',
      'Dildos dobles',
      'Plug anal',
      'Bolas chinas / Kegel',
      'Masturbadores masculinos',
      'Masturbadores tipo huevo',
      'Masturbadores automaticos',
      'Anillos para pene',
      'Bombas de vacio',
      'Juguetes para pareja',
      'Huevos vibradores con control remoto',
    ],
  },
  {
    id: 'estimulacion-anal',
    title: 'Estimulacion anal',
    teaser: 'Opciones para exploracion gradual, control y comodidad.',
    spotlight: 'Ideal para principiantes y clientes que quieren subir de nivel.',
    items: [
      'Plug anal de silicona',
      'Plug anal de metal',
      'Plug anal con joya',
      'Bolas anales',
      'Vibradores anales',
      'Kits de iniciacion anal',
      'Duchas anales',
      'Dilatadores',
    ],
  },
  {
    id: 'lubricantes-estimulantes',
    title: 'Lubricantes y estimulantes',
    teaser: 'Consumibles clave para comodidad, sensaciones y seguridad.',
    spotlight: 'Una buena recomendacion suele empezar por el lubricante correcto.',
    items: [
      'Lubricantes base agua',
      'Lubricantes base silicona',
      'Lubricantes base aceite',
      'Lubricantes anales',
      'Lubricantes saborizados',
      'Gel estimulante femenino',
      'Gel estimulante masculino',
      'Retardantes',
      'Excitantes termicos (frio/calor)',
    ],
  },
  {
    id: 'preservativos',
    title: 'Preservativos y proteccion',
    teaser: 'Proteccion erotica con variantes para sensacion y rendimiento.',
    spotlight: 'Clasicos, retardantes, texturizados y formatos de caja.',
    items: [
      'Condones clasicos',
      'Ultra delgados',
      'Extra resistentes',
      'Retardantes',
      'Texturizados',
      'Saborizados',
      'Condones femeninos',
      'Packs y cajas',
    ],
  },
  {
    id: 'lenceria',
    title: 'Lenceria erotica',
    teaser: 'Piezas para juego visual, confianza y looks de fantasia.',
    spotlight: 'Una familia fuerte para upselling y combos seductores.',
    items: [
      'Bodys',
      'Babydolls',
      'Conjuntos (brasier + panty)',
      'Corsets',
      'Medias',
      'Ligueros',
      'Lenceria masculina',
      'Disfraces eroticos',
    ],
  },
  {
    id: 'bdsm',
    title: 'BDSM y fetiche',
    teaser: 'Accesorios para dominacion, juego de roles y control consensuado.',
    spotlight: 'Perfecto para clientes que buscan intensidad y dinamica.',
    items: [
      'Esposas de metal',
      'Esposas de cuero',
      'Esposas de tela',
      'Latigos',
      'Fustas',
      'Arneses',
      'Collares y correas',
      'Mordazas',
      'Vendas',
      'Kits BDSM',
      'Jaulas de castidad',
    ],
  },
  {
    id: 'pareja',
    title: 'Productos para pareja',
    teaser: 'Todo lo necesario para juego, complicidad y sorpresa.',
    spotlight: 'Muy vendible en bundles, fechas especiales y regalos.',
    items: [
      'Juegos eroticos (dados, cartas)',
      'Kits para pareja',
      'Vibradores para pareja',
      'Aceites de masaje',
      'Velas eroticas',
    ],
  },
  {
    id: 'masculinos',
    title: 'Productos masculinos',
    teaser: 'Rendimiento, estimulacion y accesorios enfocados en el placer masculino.',
    spotlight: 'Categoria clara para consultas rapidas y recomendaciones directas.',
    items: [
      'Masturbadores',
      'Bombas de vacio',
      'Extensores / mangas',
      'Anillos para pene',
      'Retardantes',
      'Cremas potenciadoras',
    ],
  },
  {
    id: 'femeninos',
    title: 'Productos femeninos',
    teaser: 'Estimulo focalizado, bienestar y placer personalizado.',
    spotlight: 'Ideal para guiarlos por zona de estimulacion o intensidad.',
    items: [
      'Vibradores punto G',
      'Succionadores',
      'Bolas Kegel',
      'Lubricantes femeninos',
      'Estimulantes clitorales',
    ],
  },
  {
    id: 'higiene',
    title: 'Higiene intima',
    teaser: 'Soporte post uso, limpieza y cuidado del cuerpo y los accesorios.',
    spotlight: 'Clave para confianza, recompra y rutina de cuidado.',
    items: [
      'Limpiadores de juguetes',
      'Jabones intimos',
      'Toallitas intimas',
      'Duchas vaginales',
      'Duchas anales',
    ],
  },
  {
    id: 'kits-combos',
    title: 'Kits y combos',
    teaser: 'Paquetes pensados para empezar, regalar o vender mejor.',
    spotlight: 'Ayudan mucho cuando el cliente aun no sabe por donde comenzar.',
    items: [
      'Kits para principiantes',
      'Kits BDSM',
      'Kits para pareja',
      'Cajas sorpresa eroticas',
    ],
  },
  {
    id: 'accesorios',
    title: 'Accesorios y almacenamiento',
    teaser: 'Complementos funcionales para proteger, cargar y organizar.',
    spotlight: 'Categoria util para ticket promedio y recompra.',
    items: [
      'Estuches',
      'Bolsas discretas',
      'Cargadores',
      'Baterias',
      'Organizadores',
    ],
  },
  {
    id: 'smart-toys',
    title: 'Tecnologia (Smart Toys)',
    teaser: 'Dispositivos conectados para juego remoto y experiencias premium.',
    spotlight: 'Perfecto para clientes curiosos, relaciones a distancia y control por app.',
    items: [
      'Juguetes con app',
      'Vibradores bluetooth',
      'Control remoto a distancia',
      'Dispositivos inteligentes conectados',
    ],
  },
  {
    id: 'cosmetica',
    title: 'Cosmetica erotica',
    teaser: 'Texturas, aromas y sensaciones para complementar el ritual erotico.',
    spotlight: 'Convierte la compra en experiencia completa.',
    items: [
      'Aceites de masaje',
      'Perfumes con feromonas',
      'Cremas estimulantes',
      'Velas de masaje',
      'Gel corporal saborizado',
    ],
  },
];

export const STOREFRONT_TECHNICAL_ATTRIBUTES: StorefrontTechnicalAttribute[] = [
  {
    label: 'Tipo de producto',
    detail: 'Consumible o reutilizable para definir manejo comercial y sanitario.',
  },
  {
    label: 'Control sanitario',
    detail: 'Campo para control INVIMA o validacion regulatoria cuando aplique.',
  },
  {
    label: 'Restriccion de edad',
    detail: 'Marcacion obligatoria para ventas solo a mayores de edad.',
  },
  {
    label: 'Manejo de lote',
    detail: 'Seguimiento de lote para trazabilidad en inventario y auditoria.',
  },
  {
    label: 'Manejo de vencimiento',
    detail: 'Necesario en lubricantes, gels, preservativos y otros consumibles.',
  },
  {
    label: 'Temperatura de almacenamiento',
    detail: 'Dato operativo para bodega y transporte de productos sensibles.',
  },
  {
    label: 'Clasificacion IA',
    detail: 'Etiqueta automatica para catalogacion, busqueda y recomendaciones.',
  },
];

export const STOREFRONT_CHAT_QUICK_ACTIONS = [
  'Quiero algo para principiantes',
  'Busco algo para pareja',
  'Necesito ayuda con lubricantes',
  'Quiero explorar anal',
  'Que recomiendas para ella',
  'Que recomiendas para el',
  'Busco algo BDSM',
  'Quiero envio discreto',
];
