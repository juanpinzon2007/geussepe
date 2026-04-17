import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  STOREFRONT_CHAT_QUICK_ACTIONS,
  StorefrontCatalogSection,
  StorefrontTechnicalAttribute,
} from '../../data-access/storefront-curation.data';

type ChatMessage = {
  role: 'assistant' | 'user';
  text: string;
  followUps?: string[];
};

type ChatReply = {
  text: string;
  followUps: string[];
};

const EXTRA_PROMPTS = [
  'Tengo una duda de seguridad',
  'Como se limpia un juguete',
  'Quiero algo discreto',
  'Busco una recomendacion segun presupuesto',
];

@Component({
  selector: 'app-floating-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-buttons.component.html',
  styleUrl: './floating-buttons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingButtonsComponent implements OnDestroy {
  @Input() promoLabel = 'Comunidad Webcam';
  @Input() promoUrl = 'https://es.stripchat.com/';
  @Input() assistantName = 'Arlepicaron';
  @Input() helpText =
    'Preguntame como si fuera una conversacion normal: productos, uso, seguridad, limpieza, pareja, discrecion o ideas de regalo.';
  @Input() catalogSections: StorefrontCatalogSection[] = [];
  @Input() technicalAttributes: StorefrontTechnicalAttribute[] = [];
  @Output() promoClick = new EventEmitter<void>();

  private readonly messagesContainer = viewChild<ElementRef<HTMLElement>>('messagesContainer');
  private pendingReplyTimeout: number | null = null;

  readonly chatOpen = signal(false);
  readonly draft = signal('');
  readonly typing = signal(false);
  readonly quickActions = [...STOREFRONT_CHAT_QUICK_ACTIONS, ...EXTRA_PROMPTS];
  readonly starterPrompts = computed(() =>
    this.messages().length > 1 ? this.quickActions.slice(0, 4) : this.quickActions.slice(0, 8),
  );
  readonly statusCopy = computed(() => {
    if (this.typing()) {
      return 'Analizando tu consulta y armando una respuesta util.';
    }

    return this.messages().length > 1
      ? 'Modo conversacion activa.'
      : 'Asistente erotico interactivo.';
  });
  readonly messages = signal<ChatMessage[]>([
    {
      role: 'assistant',
      text:
        'Soy Arlepicaron. Puedes escribirme libremente y te respondo sobre placer, uso, seguridad, lubricantes, higiene, discrecion, regalos, pareja y categorias de la tienda.',
      followUps: [
        'Quiero algo para principiantes',
        'Busco algo para pareja',
        'Tengo una duda de seguridad',
        'Quiero algo discreto',
      ],
    },
  ]);

  toggleChat() {
    this.chatOpen.update((open) => !open);
    if (this.chatOpen()) {
      this.scrollMessagesToEnd();
    }
  }

  closeChat() {
    this.chatOpen.set(false);
  }

  updateDraft(value: string) {
    this.draft.set(value);
  }

  handleComposerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendDraft();
    }
  }

  sendDraft() {
    const question = this.draft().trim();
    if (!question) {
      return;
    }

    this.sendQuestion(question);
    this.draft.set('');
  }

  sendQuickAction(question: string) {
    this.sendQuestion(question);
    this.chatOpen.set(true);
  }

  trackByMessage(index: number, message: ChatMessage) {
    return `${message.role}-${index}`;
  }

  ngOnDestroy() {
    if (this.pendingReplyTimeout !== null) {
      window.clearTimeout(this.pendingReplyTimeout);
    }
  }

  private sendQuestion(question: string) {
    if (this.pendingReplyTimeout !== null) {
      window.clearTimeout(this.pendingReplyTimeout);
    }

    this.chatOpen.set(true);
    this.typing.set(true);
    this.messages.update((messages) => [...messages, { role: 'user', text: question }]);
    this.scrollMessagesToEnd();

    const reply = this.buildAnswer(question);
    this.pendingReplyTimeout = window.setTimeout(() => {
      this.messages.update((messages) => [
        ...messages,
        { role: 'assistant', text: reply.text, followUps: reply.followUps },
      ]);
      this.typing.set(false);
      this.pendingReplyTimeout = null;
      this.scrollMessagesToEnd();
    }, 420);
  }

  private buildAnswer(question: string): ChatReply {
    const normalized = this.normalize(question);
    const responseParts: string[] = [];
    const followUps = new Set<string>();
    const matchedSections = this.catalogSections
      .filter((section) => this.sectionMatches(section, normalized))
      .slice(0, 2);
    const matchedItems = this.resolveRelevantItems(matchedSections, normalized);

    if (this.hasAny(normalized, ['hola', 'buenas', 'hello', 'ey', 'hey'])) {
      responseParts.push(
        'Cuéntame con confianza. Si me dices para quien es, experiencia previa, nivel de intensidad y si buscas algo discreto o mas potente, te respondo mucho mejor.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo para principiantes',
        'Busco algo para pareja',
        'Quiero una recomendacion discreta',
      ]);
    }

    if (
      this.hasAny(normalized, [
        'dolor',
        'sangrado',
        'ardor',
        'alergia',
        'infeccion',
        'irritacion',
        'lesion',
      ])
    ) {
      responseParts.push(
        'Si hay dolor fuerte, sangrado, alergia o irritacion sostenida, lo prudente es pausar el uso y consultar a un profesional de salud. Yo puedo orientarte en prevencion, materiales y opciones mas suaves, pero eso ya entra en una zona mas clinica.',
      );
      this.pushFollowUps(followUps, [
        'Quiero una opcion mas suave',
        'Como elegir el material correcto',
        'Como mejorar la higiene',
      ]);
    }

    if (this.hasAny(normalized, ['principiante', 'empezar', 'inicio', 'novato', 'primera vez'])) {
      responseParts.push(
        'Para empezar conviene ir por estimulos faciles de entender: bullet discreto, succionador suave, kit para principiantes, bolas Kegel o plug pequeno si la curiosidad va por anal. La regla buena es intensidad baja, lubricante base agua y cero prisa.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo discreto',
        'Necesito lubricante para empezar',
        'Busco algo para ella',
      ]);
    }

    if (this.hasAny(normalized, ['pareja', 'juntos', 'regalo', 'sorpresa', 'romantico'])) {
      responseParts.push(
        'Si es para pareja, lo que mejor funciona es elegir segun dinamica: algo coqueto y simple si apenas exploran, control remoto o juegos eroticos si quieren complicidad, y smart toys si buscan una experiencia mas premium o a distancia.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo con control remoto',
        'Busco un regalo sensual',
        'Quiero una opcion premium',
      ]);
    }

    if (this.hasAny(normalized, ['anal', 'plug', 'dilatador', 'ducha'])) {
      responseParts.push(
        'En anal la progresion importa mucho: empieza con tamano pequeno, material amable como silicona, muchisimo lubricante anal y cero improvisacion. Si es primera vez, el combo sensato es plug pequeno + lubricante anal + limpieza sencilla.',
      );
      this.pushFollowUps(followUps, [
        'Soy principiante',
        'Que lubricante conviene',
        'Como se limpia bien',
      ]);
    }

    if (this.hasAny(normalized, ['lubricante', 'gel', 'resequedad', 'friccion'])) {
      responseParts.push(
        'La eleccion del lubricante cambia mucho la experiencia: base agua si quieres compatibilidad y facilidad, silicona si buscas deslizamiento mas duradero, anal si necesitas mas densidad y saborizado si el foco es juego oral. Si me dices para que lo quieres, te lo cierro mas fino.',
      );
      this.pushFollowUps(followUps, [
        'Lo quiero para anal',
        'Lo quiero para pareja',
        'Busco algo suave y versatil',
      ]);
    }

    if (this.hasAny(normalized, ['seguridad', 'seguro', 'riesgo', 'cuidado', 'consentimiento'])) {
      responseParts.push(
        'La base siempre es consentimiento claro, higiene, lubricacion suficiente, materiales confiables y avanzar de menos a mas. Si un producto genera molestia o el cuerpo no esta respondiendo bien, se pausa y se replantea, no se fuerza.',
      );
      this.pushFollowUps(followUps, [
        'Como se limpia un juguete',
        'Que material recomiendas',
        'Quiero algo para principiantes',
      ]);
    }

    if (this.hasAny(normalized, ['limpiar', 'limpieza', 'guardar', 'higiene', 'cuidado'])) {
      responseParts.push(
        'Para limpieza y duracion, usa limpiador de juguetes o agua tibia con jabon suave segun el material, seca bien antes de guardar y evita mezclar juguetes sin funda si son de silicona parecida. Un estuche o bolsa discreta ayuda muchisimo.',
      );
      this.pushFollowUps(followUps, [
        'Que material es mas facil de cuidar',
        'Quiero un kit de higiene',
        'Necesito almacenamiento discreto',
      ]);
    }

    if (this.hasAny(normalized, ['silicona', 'vidrio', 'metal', 'material', 'abs'])) {
      responseParts.push(
        'En materiales, silicona de buena calidad suele ser la opcion mas noble para empezar. Vidrio y metal van bien si buscas sensacion distinta y limpieza facil, pero se sienten mas intensos. Lo clave es evitar materiales porosos o demasiado dudosos si quieres una compra segura.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo suave para empezar',
        'Como se limpia cada material',
        'Quiero una recomendacion discreta',
      ]);
    }

    if (this.hasAny(normalized, ['ella', 'mujer', 'clitoris', 'punto g', 'femenino'])) {
      responseParts.push(
        'Para estimulo femenino, lo mas facil de recomendar es segun la sensacion buscada: succionador para impacto rapido, punto G si quiere profundidad, bullet si la prioridad es discrecion, y lubricante si quiere una experiencia mas comoda o prolongada.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo discreto',
        'Busco un regalo sensual',
        'Quiero una opcion intensa',
      ]);
    }

    if (this.hasAny(normalized, ['el', 'hombre', 'masculino', 'masturbador', 'anillo'])) {
      responseParts.push(
        'Para el lado masculino, la recomendacion cambia entre rapidez, presion o juego compartido: huevo si quiere algo simple, masturbador automatico si busca mas sensacion, anillo si quiere sumar intensidad y bombas solo si ya entiende bien lo que esta usando.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo discreto',
        'Busco una opcion premium',
        'Quiero algo para pareja',
      ]);
    }

    if (this.hasAny(normalized, ['bdsm', 'dominacion', 'mordaza', 'latigo', 'esposas', 'fetiche'])) {
      responseParts.push(
        'Si vas por BDSM, empieza por juego controlado y claro: kit basico, esposas suaves, vendas o collar con correa. Lo importante es acordar limites, intensidad y palabra de seguridad antes de pensar en piezas mas duras.',
      );
      this.pushFollowUps(followUps, [
        'Quiero empezar suave',
        'Busco un kit completo',
        'Quiero algo para pareja',
      ]);
    }

    if (this.hasAny(normalized, ['lenceria', 'body', 'babydoll', 'corset', 'disfraz'])) {
      responseParts.push(
        'En lenceria yo la aterrizo segun objetivo: body o corset si el cliente quiere impacto visual, babydoll si busca algo mas regalo, y disfraz si la compra va por fantasia o juego de rol.',
      );
      this.pushFollowUps(followUps, [
        'Quiero un regalo sensual',
        'Busco algo coqueto',
        'Quiero armar un combo',
      ]);
    }

    if (this.hasAny(normalized, ['discreto', 'envio', 'empaque', 'privado', 'secreto'])) {
      responseParts.push(
        'Si la prioridad es discrecion, yo iria por productos compactos, estuches, bolsas discretas y un discurso claro de privacidad. Para comprar sin llamar la atencion, bullet, lubricante pequeno o kit compacto suelen ser una ruta muy facil.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo pequeno',
        'Busco una recomendacion para principiantes',
        'Necesito almacenamiento discreto',
      ]);
    }

    if (this.hasAny(normalized, ['economico', 'barato', 'precio', 'presupuesto'])) {
      responseParts.push(
        'Si hay presupuesto ajustado, conviene priorizar una compra bien pensada en vez de varias medias: bullet, lubricante base agua, kit para principiantes o una pieza de lenceria simple suelen dar buena entrada sin disparar el ticket.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo para principiantes',
        'Busco un combo economico',
        'Quiero una recomendacion discreta',
      ]);
    }

    if (this.hasAny(normalized, ['app', 'bluetooth', 'distancia', 'smart', 'tecnologia'])) {
      responseParts.push(
        'Si la idea es una experiencia mas tipo premium, los juguetes con app, bluetooth o control remoto destacan mucho porque mezclan fantasia, juego a distancia y sensacion de novedad. Encajan muy bien en pareja o regalo.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo para pareja',
        'Busco un regalo impactante',
        'Quiero una opcion premium',
      ]);
    }

    if (this.hasAny(normalized, ['invima', 'lote', 'vencimiento', 'tecnico', 'backend'])) {
      const details = this.technicalAttributes
        .slice(0, 4)
        .map((item) => item.label)
        .join(', ');
      responseParts.push(
        `Si tu duda va por gestion o catalogo, yo controlaria minimo ${details}. Desde ahi puedes ordenar mejor restricciones de edad, trazabilidad y recomendaciones automaticas.`,
      );
      this.pushFollowUps(followUps, [
        'Quiero ayuda con catalogo',
        'Busco recomendaciones por categoria',
        'Quiero resolver una duda de discrecion',
      ]);
    }

    if (matchedItems.length) {
      responseParts.push(
        `Si quieres aterrizarlo a producto, yo miraria primero: ${matchedItems.join(', ')}.`,
      );
    }

    if (!responseParts.length) {
      responseParts.push(
        'Te puedo orientar en placer, productos, materiales, limpieza, seguridad, discrecion, regalos, pareja, BDSM, lubricantes y categorias del sex shop. Si me das mas contexto sobre para quien es, experiencia previa y sensacion buscada, te respondo mucho mas como un asesor real.',
      );
      this.pushFollowUps(followUps, [
        'Quiero algo para principiantes',
        'Busco algo para pareja',
        'Tengo una duda de seguridad',
      ]);
    }

    return this.reply(responseParts.join('\n\n'), [...followUps].slice(0, 4));
  }

  private hasAny(value: string, keywords: string[]) {
    return keywords.some((keyword) => value.includes(keyword));
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private sectionMatches(section: StorefrontCatalogSection, question: string) {
    const candidates = [section.title, section.id, ...section.items].map((value) => this.normalize(value));
    return candidates.some((candidate) => question.includes(candidate));
  }

  private resolveRelevantItems(sections: StorefrontCatalogSection[], normalizedQuestion: string) {
    if (sections.length) {
      return sections.flatMap((section) => section.items).slice(0, 6);
    }

    if (this.hasAny(normalizedQuestion, ['lubricante', 'gel', 'resequedad'])) {
      return ['Lubricantes base agua', 'Lubricantes base silicona', 'Lubricantes anales'];
    }

    if (this.hasAny(normalizedQuestion, ['discreto', 'pequeno', 'secreto'])) {
      return ['Bullet', 'Bolsas discretas', 'Estuches'];
    }

    if (this.hasAny(normalizedQuestion, ['pareja', 'regalo'])) {
      return ['Kits para pareja', 'Aceites de masaje', 'Huevos vibradores con control remoto'];
    }

    return [];
  }

  private pushFollowUps(target: Set<string>, values: string[]) {
    for (const value of values) {
      target.add(value);
    }
  }

  private reply(text: string, followUps: string[]): ChatReply {
    return { text, followUps };
  }

  private scrollMessagesToEnd() {
    queueMicrotask(() => {
      const container = this.messagesContainer()?.nativeElement;
      if (!container) {
        return;
      }

      container.scrollTop = container.scrollHeight;
    });
  }
}
