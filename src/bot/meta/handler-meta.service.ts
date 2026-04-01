import { Injectable, Logger } from '@nestjs/common';
import { EstadoRepository } from '../estado.repository';
import { HandlerService } from '../handler.service';

type MetaListRow = {
  id: string;
  title: string;
  description?: string;
};

type MetaListSection = {
  title: string;
  rows: MetaListRow[];
};

type MetaListPayload = {
  body: string;
  button: string;
  sections: MetaListSection[];
  footer?: string;
  header?: string;
};

type MetaButtonsPayload = {
  body: string;
  buttons: Array<{ id: string; title: string }>;
  footer?: string;
  header?: string;
};

@Injectable()
export class HandlerMetaService extends HandlerService {
  private readonly metaLogger = new Logger(HandlerMetaService.name);

  /** Definidos pelo BotMetaService antes de cada processamento */
  public phone_id: string | null = null;
  public access_token: string | null = null;

  constructor(estadoRepo: EstadoRepository) {
    super(estadoRepo);

    this.client = {
      sendText: async (destino: string, texto: string) => {
        await this.enviarTextoMeta(destino, texto);
      },
      sendListMessage: async (destino: string, payload: unknown) => {
        await this.enviarListaMeta(destino, payload);
      },
      sendButtonsMessage: async (destino: string, payload: unknown) => {
        await this.enviarBotoesMeta(destino, payload);
      },
    };
  }

  configureChannel(phoneId: string | null, accessToken: string | null): void {
    this.phone_id = phoneId;
    this.access_token = accessToken;
  }

  private isMetaRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toMetaStringOrNull(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
    return null;
  }

  private normalizarDestino(destino: string): string {
    return destino.replace(/@(meta|c\.us)$/, '');
  }

  private async chamadaMetaAPI(payload: Record<string, unknown>): Promise<void> {
    if (!this.phone_id || !this.access_token) {
      throw new Error('Meta API não inicializada: phone_id ou access_token ausente.');
    }

    const url = `https://graph.facebook.com/v18.0/${this.phone_id}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        `Erro na Meta API [${response.status}]: ${JSON.stringify(errData)}`,
      );
    }
  }

  private async enviarTextoMeta(destino: string, texto: string): Promise<void> {
    const to = this.normalizarDestino(destino);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: texto },
    };

    await this.chamadaMetaAPI(payload);
    this.metaLogger.log('Mensagem enviada com sucesso via Meta API.');
  }

  private normalizarPayloadLista(payload: unknown): MetaListPayload | null {
    if (!this.isMetaRecord(payload)) return null;

    const body =
      this.toMetaStringOrNull(payload.description) ||
      this.toMetaStringOrNull(payload.body) ||
      this.toMetaStringOrNull(payload.title) ||
      'Menu';
    const button =
      this.toMetaStringOrNull(payload.buttonText) ||
      this.toMetaStringOrNull(payload.button) ||
      'Selecione';

    const sectionsRaw = Array.isArray(payload.sections) ? payload.sections : [];
    const sections: MetaListSection[] = [];

    for (const sectionRaw of sectionsRaw) {
      if (!this.isMetaRecord(sectionRaw)) continue;
      const rowsRaw = Array.isArray(sectionRaw.rows) ? sectionRaw.rows : [];
      const rows: MetaListRow[] = [];

      for (const rowRaw of rowsRaw) {
        if (!this.isMetaRecord(rowRaw)) continue;

        const id =
          this.toMetaStringOrNull(rowRaw.rowId) ||
          this.toMetaStringOrNull(rowRaw.id) ||
          this.toMetaStringOrNull(rowRaw.value) ||
          this.toMetaStringOrNull(rowRaw.payload) ||
          '';
        const title =
          this.toMetaStringOrNull(rowRaw.title) ||
          this.toMetaStringOrNull(rowRaw.text) ||
          this.toMetaStringOrNull(rowRaw.label) ||
          '';

        if (!id || !title) continue;

        rows.push({
          id: id.substring(0, 200),
          title: title.substring(0, 24),
          description: this.toMetaStringOrNull(rowRaw.description)?.substring(0, 72),
        });
      }

      if (!rows.length) continue;

      const sectionTitle =
        this.toMetaStringOrNull(sectionRaw.title) ||
        this.toMetaStringOrNull(sectionRaw.name) ||
        'Opções';

      sections.push({
        title: sectionTitle.substring(0, 24),
        rows: rows.slice(0, 10),
      });
    }

    if (!sections.length) return null;

    return {
      body: body.substring(0, 1024),
      button: button.substring(0, 20),
      sections: sections.slice(0, 10),
      footer: this.toMetaStringOrNull(payload.footer)?.substring(0, 60),
      header: this.toMetaStringOrNull(payload.header)?.substring(0, 60),
    };
  }

  private async enviarListaMeta(destino: string, payload: unknown): Promise<void> {
    const to = this.normalizarDestino(destino);
    const normalizado = this.normalizarPayloadLista(payload);
    if (!normalizado) {
      throw new Error('Payload de lista inválido para Meta API.');
    }

    const interactive: Record<string, unknown> = {
      type: 'list',
      body: { text: normalizado.body },
      action: {
        button: normalizado.button,
        sections: normalizado.sections,
      },
    };

    if (normalizado.footer) {
      interactive.footer = { text: normalizado.footer };
    }

    if (normalizado.header) {
      interactive.header = {
        type: 'text',
        text: normalizado.header,
      };
    }

    await this.chamadaMetaAPI({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    });

    this.metaLogger.log('Mensagem enviada com sucesso via Meta API.');
  }

  private normalizarPayloadBotoes(payload: unknown): MetaButtonsPayload | null {
    if (!this.isMetaRecord(payload)) return null;

    const body =
      this.toMetaStringOrNull(payload.body) ||
      this.toMetaStringOrNull(payload.titulo) ||
      'Escolha uma opção:';

    const buttonsRaw = Array.isArray(payload.buttons) ? payload.buttons : [];
    const buttons = buttonsRaw
      .map((btn) => {
        if (!this.isMetaRecord(btn)) return null;

        const id =
          this.toMetaStringOrNull(btn.id) || this.toMetaStringOrNull(btn.payload);
        const title =
          this.toMetaStringOrNull(btn.title) || this.toMetaStringOrNull(btn.text);
        if (!id || !title) return null;

        return {
          id: id.substring(0, 256),
          title: title.substring(0, 20),
        };
      })
      .filter((btn): btn is { id: string; title: string } => !!btn)
      .slice(0, 3);

    if (!buttons.length) return null;

    return {
      body: body.substring(0, 1024),
      buttons,
      footer: this.toMetaStringOrNull(payload.footer)?.substring(0, 60),
      header: this.toMetaStringOrNull(payload.header)?.substring(0, 60),
    };
  }

  private async enviarBotoesMeta(destino: string, payload: unknown): Promise<void> {
    const to = this.normalizarDestino(destino);
    const normalizado = this.normalizarPayloadBotoes(payload);
    if (!normalizado) {
      throw new Error('Payload de botões inválido para Meta API.');
    }

    const interactive: Record<string, unknown> = {
      type: 'button',
      body: { text: normalizado.body },
      action: {
        buttons: normalizado.buttons.map((button) => ({
          type: 'reply',
          reply: {
            id: button.id,
            title: button.title,
          },
        })),
      },
    };

    if (normalizado.footer) {
      interactive.footer = { text: normalizado.footer };
    }

    if (normalizado.header) {
      interactive.header = {
        type: 'text',
        text: normalizado.header,
      };
    }

    await this.chamadaMetaAPI({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    });

    this.metaLogger.log('Mensagem enviada com sucesso via Meta API.');
  }
}
