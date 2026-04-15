import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  STOREFRONT_CHAT_QUICK_ACTIONS,
  StorefrontCatalogSection,
  StorefrontTechnicalAttribute,
} from '../../data-access/storefront-curation.data';

type ChatMessage = {
  role: 'assistant' | 'user';
  text: string;
};

@Component({
  selector: 'app-floating-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-buttons.component.html',
  styleUrl: './floating-buttons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingButtonsComponent {
  @Input() promoLabel = 'Comunidad Webcam';
  @Input() promoUrl = 'https://es.stripchat.com/';
  @Input() assistantName = 'Candela';
  @Input() helpText =
    'Te oriento sin rodeos con juguetes, lubricantes, lenceria, BDSM, higiene y pedidos discretos.';
  @Input() catalogSections: StorefrontCatalogSection[] = [];
  @Input() technicalAttributes: StorefrontTechnicalAttribute[] = [];
  @Output() promoClick = new EventEmitter<void>();

  readonly chatOpen = signal(false);
  readonly draft = signal('');
  readonly quickActions = STOREFRONT_CHAT_QUICK_ACTIONS;
  readonly messages = signal<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Soy Candela. Preguntame que buscas y te aterrizo opciones claras, atrevidas y utiles.',
    },
  ]);

  toggleChat() {
    this.chatOpen.update((open) => !open);
  }

  closeChat() {
    this.chatOpen.set(false);
  }

  updateDraft(value: string) {
    this.draft.set(value);
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

  trackByMessage(index: number) {
    return index;
  }

  private sendQuestion(question: string) {
    this.messages.update((messages) => [...messages, { role: 'user', text: question }]);
    this.messages.update((messages) => [
      ...messages,
      { role: 'assistant', text: this.buildAnswer(question) },
    ]);
  }

  private buildAnswer(question: string) {
    const normalized = this.normalize(question);

    if (this.hasAny(normalized, ['principiante', 'empezar', 'inicio', 'iniciar', 'novato'])) {
      return 'Si quieres empezar suave, te guiaria por kits para principiantes, bullets, succionadores suaves, bolas Kegel y lubricante base agua. Es una entrada segura, comoda y facil de vender en combo.';
    }

    if (this.hasAny(normalized, ['pareja', 'juntos', 'regalo', 'sorpresa', 'remoto'])) {
      return 'Para pareja estan muy fuertes los kits para pareja, huevos vibradores con control remoto, juegos eroticos, vibradores para pareja y aceites de masaje. Si buscas algo coqueto y facil de usar, esa es la ruta.';
    }

    if (this.hasAny(normalized, ['lubricante', 'reseco', 'friccion', 'gel'])) {
      return 'Base agua si quieres compatibilidad y versatilidad. Base silicona si buscas deslizamiento mas duradero. Anal si necesitas mas densidad. Saborizado si el enfoque es juego oral. Si me dices para que uso lo quieres, te cierro la recomendacion.';
    }

    if (this.hasAny(normalized, ['anal', 'plug', 'dilatador', 'ducha'])) {
      return 'En anal conviene ir por progresion: kits de iniciacion, plug de silicona, lubricante anal, bolas anales y luego vibradores anales o dilatadores. Si el cliente es nuevo, el combo ganador es plug pequeno + lubricante anal + ducha anal.';
    }

    if (this.hasAny(normalized, ['ella', 'femenino', 'clitoris', 'clitorial', 'mujer'])) {
      return 'Para ella recomiendo succionadores, vibradores punto G, bullets, bolas Kegel y lubricantes femeninos. Si busca sensacion intensa, succionador. Si quiere profundidad, punto G. Si quiere discrecion, bullet.';
    }

    if (this.hasAny(normalized, ['el', 'masculino', 'hombre', 'pene', 'masturbador'])) {
      return 'Para el salen muy bien los masturbadores, anillos para pene, bombas de vacio, extensores y retardantes. Si busca sensacion rapida, tipo huevo. Si quiere mas potencia, automatico o bomba de vacio.';
    }

    if (this.hasAny(normalized, ['bdsm', 'dominacion', 'fetiche', 'esposa', 'mordaza', 'latigo'])) {
      return 'En BDSM puedes mover kits completos, esposas, arneses, collares con correa, mordazas, latigos y vendas. Para alguien que apenas explora, lo mejor es un kit BDSM basico antes de pasar a piezas mas intensas.';
    }

    if (this.hasAny(normalized, ['lenceria', 'body', 'babydoll', 'corset', 'disfraz'])) {
      return 'La linea de lenceria erotica cubre bodys, babydolls, conjuntos, corsets, medias, ligueros, versiones masculinas y disfraces eroticos. Si el cliente quiere impacto visual, body o corset. Si busca algo regalo, babydoll o disfraz.';
    }

    if (this.hasAny(normalized, ['discreto', 'envio', 'empaque', 'secreto', 'privado'])) {
      return 'La conversacion y la entrega deben manejarse de forma discreta. Puedes empujar bolsas discretas, estuches y organizadores, y comunicar que el pedido se orienta con privacidad y sin detalles innecesarios en la experiencia.';
    }

    if (this.hasAny(normalized, ['higiene', 'limpieza', 'limpiar', 'jabon', 'toallita'])) {
      return 'Para higiene intima y cuidado del juguete ten listos limpiadores de juguetes, jabones intimos, toallitas, duchas vaginales y duchas anales. Es una categoria excelente para cerrar venta responsable y recompra.';
    }

    if (this.hasAny(normalized, ['app', 'bluetooth', 'distancia', 'smart', 'tecnologia'])) {
      return 'En smart toys metemos juguetes con app, vibradores bluetooth, control remoto a distancia y dispositivos conectados. Es una categoria premium que funciona muy bien para pareja, fantasia y relaciones a distancia.';
    }

    if (this.hasAny(normalized, ['invima', 'lote', 'vencimiento', 'backend', 'tecnico', 'tecnica'])) {
      const details = this.technicalAttributes
        .slice(0, 4)
        .map((item) => item.label)
        .join(', ');
      return `En backend yo controlaria minimo ${details}. Tambien conviene marcar restriccion de edad, temperatura de almacenamiento y clasificacion IA para automatizar catalogo, auditoria y cumplimiento.`;
    }

    const matchedSection = this.catalogSections.find((section) =>
      this.sectionMatches(section, normalized),
    );

    if (matchedSection) {
      const items = matchedSection.items.slice(0, 5).join(', ');
      return `Si vas por ${matchedSection.title.toLowerCase()}, el frente mas fuerte es ${items}. ${matchedSection.spotlight}`;
    }

    return 'Te puedo ayudar con juguetes sexuales, anal, lubricantes, preservativos, lenceria, BDSM, pareja, higiene, smart toys y combos. Dime que quieres sentir o para quien es, y te dejo la ruta mas acertada.';
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
}
