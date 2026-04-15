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
        const zenviaPayload = {
          type: 'list',
          header: {
            type: 'text',
            text: (payload.buttonText || 'Selecione:').slice(0, 60),
          },
          body: (payload.description || 'Escolha uma opção abaixo:').slice(0, 1024),
          button: (payload.buttonText || 'Ver Opções').slice(0, 20),
          footer: (payload.footer || '').slice(0, 60),
          sections: (payload.sections || []).slice(0, 1).map((s: any) => ({
            title: (s.title || 'Opções').slice(0, 24),
            rows: (s.rows || []).slice(0, 10).map((r: any) => ({
              id: String(r.rowId),
              title: (r.title || r.rowId || 'Opção').slice(0, 24),
              description: (r.description || '').slice(0, 72),
            })),
          })),
        };
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

  // ─── Handlers Dinâmicos para Fluxo Zenvia ─────────────────────────────────

  async _handlerZenviaCallback(_message: any, chatId: string, _corpo: string, engine: StateMachineEngine) {
    this.zenviaLogger.log(`[HandlerZenvia] Executando _handlerZenviaCallback para ${chatId}`);
    
    const sessaoRaw = await this.estadoRepo.redis.get(`session:${chatId}`);
    if (!sessaoRaw) return;
    
    const sessao = JSON.parse(sessaoRaw);
    const meta = sessao.meta;
    if (!meta || !meta.callbackUrl) {
        this.zenviaLogger.warn(`[HandlerZenvia] Sem callbackUrl para ${chatId}. Pulando.`);
        return;
    }

    const dados = engine.obterDados(chatId);
    const respostas = Object.keys(dados)
      .filter(k => k.startsWith('item_'))
      .map(k => ({ chave: k, resposta: dados[k] }));

    try {
        this.zenviaLogger.log(`[HandlerZenvia] Enviando POST para ${meta.callbackUrl}`);
        const res = await fetch(meta.callbackUrl, {
            method: 'POST',
            headers: { 
                ...meta.callbackHeaders, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                pesquisa_id: meta.pesquisa_id,
                conversa_id: meta.conversa_id,
                status: 'completed',
                respostas,
            }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => 'N/A');
            this.zenviaLogger.error(`[HandlerZenvia] Falha no callback (salva respostas): Status ${res.status} | Resposta: ${body}`);
        } else {
            this.zenviaLogger.log(`[HandlerZenvia] Callback de respostas enviado com sucesso.`);
        }
    } catch (e) {
        this.zenviaLogger.error(`[HandlerZenvia] Erro ao disparar callback: ${e}`);
    }
  }

  async _handlerZenviaFinalize(_message: any, chatId: string, _corpo: string, engine: StateMachineEngine) {
    this.zenviaLogger.log(`[HandlerZenvia] Executando _handlerZenviaFinalize para ${chatId}`);

    const sessaoRaw = await this.estadoRepo.redis.get(`session:${chatId}`);
    if (!sessaoRaw) return;
    
    const sessao = JSON.parse(sessaoRaw);
    const meta = sessao.meta;
    if (!meta || !meta.callbackUrl) return;

    try {
        let finalizaUrl = '';
        if (meta.callbackUrl.includes('/chatboot/')) {
            const pathBeforeChatboot = meta.callbackUrl.split('/chatboot/')[0];
            finalizaUrl = `${pathBeforeChatboot}/chatboot/finalizaConversa`;
        } else {
            const urlObj = new URL(meta.callbackUrl);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            finalizaUrl = `${baseUrl}/api-chatboot-proxy-telezap/chatboot/finalizaConversa`;
        }
        
        // Determina o tipo de fluxo baseado no contexto original
        const fluxo = meta.tipoPesquisa || 'csat';

        const appKey = meta.callbackHeaders?.['access-application-key'] || 
                       meta.callbackHeaders?.['Access-Application-Key'] ||
                       meta.zenviaHeaders?.['access-application-key'] ||
                       '555078a0ec066392a7e50c44a4342a97902e6430'; // Fallback para a chave fornecida

        this.zenviaLogger.log(`[HandlerZenvia] Finalizando conversa no proxy: ${finalizaUrl}`);
        
        const res = await fetch(finalizaUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access-application-key': appKey,
            },
            body: JSON.stringify({
                fluxo: fluxo,
                celular: meta.to,
            }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => 'N/A');
            this.zenviaLogger.error(`[HandlerZenvia] Falha ao finalizar proxy: Status ${res.status} | Resposta: ${body}`);
        } else {
            this.zenviaLogger.log(`[HandlerZenvia] Conversa finalizada no proxy com sucesso.`);
        }
    } catch (e) {
        this.zenviaLogger.error(`[HandlerZenvia] Erro ao finalizar conversa no proxy: ${e}`);
    }
  }
}
