import { Injectable, Logger } from '@nestjs/common';
import { EstadoRepository } from '../estado.repository';
import { HandlerService } from '../handler.service';
import { StateMachineEngine } from '../state-machine.engine';
import { ZenviaSessionContext } from './interfaces/zenvia.interface';

@Injectable()
export class HandlerZenviaService extends HandlerService {
  private readonly zenviaLogger = new Logger(HandlerZenviaService.name);

  /** Configuração para o contexto de execução atual (Pesquisa context) */
  private sessionContext: ZenviaSessionContext | null = null;

  constructor(estadoRepo: EstadoRepository) {
    super(estadoRepo);

    this.client = {
      sendText: async (destino: string, texto: string, chatId?: string) => {
        await this.enviarNoZenvia(destino, { type: 'text', text: texto }, chatId);
      },
      sendListMessage: async (destino: string, payload: any, chatId?: string) => {
        const zenviaPayload: any = {
          type: 'interactive',
          interactive: {
            type: 'list',
            body: {
              text: (payload.description || 'Escolha uma opção abaixo:').slice(0, 1024),
            },
            action: {
              button: (payload.buttonText || 'Ver Opções').slice(0, 20),
              sections: (payload.sections || []).slice(0, 1).map((s: any) => ({
                title: (s.title || 'Opções').slice(0, 24),
                rows: (s.rows || []).slice(0, 10).map((r: any) => ({
                  id: String(r.rowId),
                  title: (r.title || r.rowId || 'Opção').slice(0, 24),
                  description: (r.description || '').slice(0, 72),
                })),
              })),
            },
          },
        };

        if (payload.header) {
          zenviaPayload.interactive.header = {
            type: 'text',
            text: String(payload.header).slice(0, 60),
          };
        }

        if (payload.footer) {
          zenviaPayload.interactive.footer = {
            text: String(payload.footer).slice(0, 60),
          };
        }

        await this.enviarNoZenvia(destino, zenviaPayload, chatId);
      },
      sendButtonsMessage: async (destino: string, payload: any, chatId?: string) => {
        const zenviaPayload = {
          type: 'button',
          body: (payload.body || 'Escolha uma opção:').slice(0, 1024),
          buttons: (payload.buttons || []).slice(0, 3).map((b: any) => ({
            id: String(b.id),
            title: (b.title || b.id).slice(0, 20),
          })),
        };
        await this.enviarNoZenvia(destino, zenviaPayload, chatId);
      },
    };
  }

  setContext(ctx: ZenviaSessionContext) {
    this.sessionContext = ctx;
  }

  private async enviarNoZenvia(destino: string, content: any, chatId?: string): Promise<void> {
    this.zenviaLogger.log(`[Zenvia] Tentando enviar resposta para ${destino} (chatId: ${chatId})`);
    
    if (!this.sessionContext && chatId) {
      this.zenviaLogger.warn(`[Zenvia] Contexto ausente em memória. Recuperando via Redis para ${chatId}...`);
      try {
        const sessaoRaw = await this.estadoRepo.redis.get(`session:${chatId}`);
        if (sessaoRaw) {
          const sessao = JSON.parse(sessaoRaw);
          if (sessao.meta && sessao.meta.zenviaToken) {
            this.setContext({
              from: sessao.meta.from,
              to: sessao.meta.to,
              token: sessao.meta.zenviaToken,
              baseUrl: sessao.meta.zenviaBaseUrl,
              headers: sessao.meta.zenviaHeaders || {},
            });
          }
        }
      } catch (e) {
        this.zenviaLogger.error(`Erro ao recuperar contexto do Redis: ${String(e)}`);
      }
    }

    if (!this.sessionContext) {
      throw new Error(`Contexto Zenvia não inicializado para o destino ${destino}.`);
    }

    const { from, token, baseUrl, headers } = this.sessionContext;
    const to = destino; // Prioriza o destino passado pelo handler
    const tokenLimpo = token.trim().replace(/^"(.*)"$/, '$1');

    this.zenviaLogger.log(`[HandlerZenvia] Enviando para ${to} via ${baseUrl}`);

    try {
        const normalizedContent = typeof content === 'string' 
            ? { type: 'text', text: content } 
            : content;

        const body = JSON.stringify({
            from,
            to,
            contents: [normalizedContent],
        });

        this.zenviaLogger.log(`[Zenvia] POST ${baseUrl} | Destino: ${to} | Body: ${body}`);

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                ...headers,
                'X-API-TOKEN': tokenLimpo,
                'Content-Type': 'application/json',
            },
            body,
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '{}');
            this.zenviaLogger.error(`[Zenvia] Falha no Envio! Status: ${response.status} | Resposta: ${errBody}`);
            throw new Error(`Zenvia API Error [${response.status}]: ${errBody}`);
        } else {
            this.zenviaLogger.log(`[Zenvia] Mensagem enviada com sucesso para ${to}.`);
        }
    } catch (err) {
        this.zenviaLogger.error(`Erro ao enviar mensagem Zenvia: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
    }
  }

}
