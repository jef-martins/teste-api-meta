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
        await this.enviarNoZenvia(destino, texto, chatId);
      },
      sendListMessage: async (destino: string, payload: unknown, chatId?: string) => {
          // Implementação simplificada: converte em texto para canais legados
          await this.enviarNoZenvia(destino, 'Escolha uma opção:\n\n' + JSON.stringify(payload), chatId);
      },
      sendButtonsMessage: async (destino: string, payload: unknown, chatId?: string) => {
          await this.enviarNoZenvia(destino, 'Escolha uma opção:\n\n' + JSON.stringify(payload), chatId);
      }
    };
  }

  setContext(ctx: ZenviaSessionContext) {
    this.sessionContext = ctx;
  }

  private async enviarNoZenvia(destino: string, texto: string, chatId?: string): Promise<void> {
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
        const body = JSON.stringify({
            from,
            to,
            contents: [{ type: 'text', text: texto }],
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
            const errData = await response.json().catch(() => ({}));
            this.zenviaLogger.error(`[Zenvia] Falha no Envio! Status: ${response.status} | Resposta: ${JSON.stringify(errData)}`);
            throw new Error(`Zenvia API Error [${response.status}]: ${JSON.stringify(errData)}`);
        } else {
            this.zenviaLogger.log(`[Zenvia] Mensagem enviada com sucesso para ${to}.`);
        }
    } catch (err) {
        this.zenviaLogger.error(`Erro ao enviar mensagem Zenvia: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
    }
  }
}
