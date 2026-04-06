import { Injectable, Logger } from '@nestjs/common';
import { EstadoRepository } from '../estado.repository';
import { HandlerService } from '../handler.service';
import { StateMachineEngine } from '../state-machine.engine';

@Injectable()
export class HandlerZenviaService extends HandlerService {
  private readonly zenviaLogger = new Logger(HandlerZenviaService.name);

  /** Configuração para o contexto de execução atual (NPS context) */
  private sessionContext: {
    from: string;
    to: string;
    token: string;
    baseUrl: string;
    headers: Record<string, string>;
  } | null = null;

  constructor(estadoRepo: EstadoRepository) {
    super(estadoRepo);

    this.client = {
      sendText: async (destino: string, texto: string) => {
        await this.enviarNoZenvia(destino, texto);
      },
      sendListMessage: async (destino: string, payload: unknown) => {
          // Implementação simplificada: converte em texto para canais legados
          // O ZenviaService tem sua própria lógica de lista, mas aqui unificamos via HandlerService.
          await this.enviarNoZenvia(destino, 'Escolha uma opção:\n\n' + JSON.stringify(payload));
      },
      sendButtonsMessage: async (destino: string, payload: unknown) => {
          await this.enviarNoZenvia(destino, 'Escolha uma opção:\n\n' + JSON.stringify(payload));
      }
    };
  }

  setContext(ctx: { from: string, to: string, token: string, baseUrl: string, headers: Record<string, string> }) {
    this.sessionContext = ctx;
  }

  private async enviarNoZenvia(destino: string, texto: string): Promise<void> {
    if (!this.sessionContext) {
      throw new Error('Contexto Zenvia não inicializado no Handler.');
    }

    const { from, to, token, baseUrl, headers } = this.sessionContext;
    const tokenLimpo = token.trim().replace(/^"(.*)"$/, '$1');

    this.zenviaLogger.log(`[HandlerZenvia] Enviando para ${to} via ${baseUrl}`);

    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                ...headers,
                'X-API-TOKEN': tokenLimpo,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to,
                contents: [{ type: 'text', text: texto }],
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`Zenvia API Error [${response.status}]: ${JSON.stringify(errData)}`);
        }
    } catch (err) {
        this.zenviaLogger.error(`Erro ao enviar mensagem Zenvia: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
    }
  }
}
