import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Client, TextContent } from '@zenvia/sdk';
import { EstadoRepository } from '../estado.repository';
import { HandlerService } from '../handler.service';
import { StateMachineEngine } from '../state-machine.engine';
import { RedisService } from '../../redis/redis.service';
import { IdleExpirationService } from '../idle-expiration.service';
import { HandlerZenviaService } from './handler-zenvia.service';

type PrimitiveId = string | number;

type OpcoesValidacaoObjeto = {
  validation?: unknown;
  mensagem_resposta_invalida?: string;
  mensagem_expiracao?: string;
};

type InputItem = {
  id?: PrimitiveId;
  ordem?: number;
  tipo?: string;
  texto?: string;
  opcoes_validacao?: string | number | null | OpcoesValidacaoObjeto;
  opcoesValidacao?: string | number | null | OpcoesValidacaoObjeto;
  mensagem?: string;
};

type ItemResposta = {
  id: PrimitiveId;
  ordem: number;
  tipo: string;
  mensagem: string;
  opcoesValidacao: string[];
  mensagemInvalida: string | null;
  mensagemExpiracao: string | null;
  exigeResposta: boolean;
  resposta: string | null;
  perguntaMessageId: string | null;
  perguntaProviderResponse: unknown | null;
  respostaMessageId: string | null;
  respondidoEm: string | null;
};

type SessaoStatus = 'active' | 'completed';

type StartInput = {
  nps_id?: string;
  conversa_id?: string;
  from?: string;
  to?: string;
  itens?: InputItem[];
  mensagens?: InputItem[];
  callbackUrl?: string;
  callbackHeaders?: Record<string, string>;
  headers?: Record<string, string>;
  Headers?: Record<string, string>;
  zenviaToken?: string;
  zenviaBaseUrl?: string;
  zenviaWebhookSecret?: string;
  zenviaHeaders?: Record<string, string>;
  ZENVIA_TOKEN?: string;
  ZENVIA_WHATSAPP_FROM?: string;
  ZENVIA_BASE_URL?: string;
  ZENVIA_WEBHOOK_SECRET?: string;
  tempo_expiracao_minutos?: number | null;
  tempoExpiracaoMinutos?: number | null;
};

type NormalizedInbound = {
  from: string;
  to: string;
  text: string;
  nps_id: string | null;
  sourceType: 'interactive' | 'button' | 'text' | 'unknown';
};

type FetchJsonResult = {
  messageId: string | null;
  payload: unknown;
};

type ZenviaButtonItem = {
  id: string;
  title: string;
};

type ButtonsClientPayload = {
  body?: unknown;
  titulo?: unknown;
  buttons?: unknown;
};

type ZenviaListRow = {
  id: string;
  title: string;
  description?: string;
};

type ZenviaListSection = {
  title: string;
  rows: ZenviaListRow[];
};

type ZenviaListContent = {
  type: 'list';
  body: string;
  button: string;
  sections: ZenviaListSection[];
  header?: string;
  footer?: string;
};

type StartQueryInput = {
  to?: string;
  from?: string;
  token?: string;
  baseUrl?: string;
  webhookSecret?: string;
  nps_id?: string;
};

@Injectable()
export class ZenviaService implements OnModuleDestroy {
  private readonly logger = new Logger(ZenviaService.name);
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(
    private redis: RedisService,
    private idleExpiration: IdleExpirationService,
    private engine: StateMachineEngine,
    private handlerZenvia: HandlerZenviaService,
    private estadoRepo: EstadoRepository,
  ) {
    this.cleanupTimer = setInterval(() => this.limparExpiradas(), 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toStringOrNull(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
    return null;
  }

  private normalizarPar(from: string, to: string): string {
    const p1 = from.trim();
    const p2 = to.trim();
    return [p1, p2].sort().join('::');
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private maskPhone(phone: string | null | undefined): string {
    if (!phone) return 'null';
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return 'invalid';
    return `${digits.slice(0, 4)}***${digits.slice(-2)}`;
  }

  private maskToken(token: string | null | undefined): string {
    if (!token) return 'null';
    const clean = token.trim().replace(/^"(.*)"$/, '$1');
    return `${clean.slice(0, 4)}***${clean.slice(-2)}`;
  }

  private stringifySafe(value: unknown, maxLen = 2500): string {
    try {
      const raw = JSON.stringify(value);
      if (!raw) return 'null';
      return raw.length > maxLen ? `${raw.slice(0, maxLen)}...(truncated)` : raw;
    } catch {
      return '[unserializable]';
    }
  }

  private errorToString(err: unknown): string {
    if (err instanceof Error) return `${err.name}: ${err.message}`;
    return String(err);
  }

  private maskHeaders(headers: Record<string, string>): Record<string, string> {
    const entries = Object.entries(headers || {}).map(([key, value]) => {
      const keyLower = key.toLowerCase();
      const isSensitive =
        keyLower.includes('token') ||
        keyLower.includes('authorization') ||
        keyLower.includes('secret') ||
        keyLower.includes('key');
      return [key, isSensitive ? this.maskToken(value) : value] as const;
    });
    return Object.fromEntries(entries);
  }

  private toNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private normalizeTipo(value: unknown): string {
    const tipo = this.toStringOrNull(value)?.toLowerCase() ?? 'descritiva';
    const accepted = ['botao', 'numerica', 'lista', 'descritiva', 'get_location', 'encerramento'];
    return accepted.includes(tipo) ? tipo : 'descritiva';
  }

  private normalizeEntrada(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private extrairOpcoesValidacaoDoObjeto(value: unknown) {
    if (!this.isRecord(value)) {
      return {
        opcoes: this.parseOpcoesValidacao(value),
        mensagemInvalida: null,
        mensagemExpiracao: null,
      };
    }
    return {
      opcoes: this.parseOpcoesValidacao(value.validation),
      mensagemInvalida: this.toStringOrNull(value.mensagem_resposta_invalida),
      mensagemExpiracao: this.toStringOrNull(value.mensagem_expiracao),
    };
  }

  private parseOpcoesValidacao(value: unknown): string[] {
    if (value === null || value === undefined) return [];
    if (this.isRecord(value)) return this.parseOpcoesValidacao(value.validation);

    let parts: string[] = [];
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return [];
      const rangeMatch = raw.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const end = Number(rangeMatch[2]);
        if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
          const span = end - start;
          if (span <= 100) {
            return Array.from({ length: span + 1 }, (_, i) => String(start + i));
          }
        }
      }
      parts = raw.split(',');
    } else if (Array.isArray(value)) {
      parts = value.map((v) => String(v));
    } else {
      const str = this.toStringOrNull(value);
      if (str) parts = [str];
    }

    return Array.from(new Set(parts.map((p) => p.trim()).filter((p) => !!p)));
  }

  private normalizeStartInput(body: unknown, query?: StartQueryInput) {
    let payload: StartInput = {};
    if (Array.isArray(body)) payload.itens = body as InputItem[];
    else if (this.isRecord(body)) payload = body as StartInput;

    const nps_id = this.toStringOrNull(query?.nps_id) || this.toStringOrNull(payload.nps_id);
    const conversa_id = this.toStringOrNull(payload.conversa_id);
    const from = this.toStringOrNull(query?.from) || this.toStringOrNull(payload.from) || this.toStringOrNull(payload.ZENVIA_WHATSAPP_FROM);
    const to = this.toStringOrNull(query?.to) || this.toStringOrNull(payload.to);
    const zenviaToken = this.toStringOrNull(query?.token) || this.toStringOrNull(payload.zenviaToken) || this.toStringOrNull(payload.ZENVIA_TOKEN);
    const zenviaBaseUrl = this.toStringOrNull(query?.baseUrl) || this.toStringOrNull(payload.zenviaBaseUrl) || this.toStringOrNull(payload.ZENVIA_BASE_URL) || 'https://api.zenvia.com/v2/channels/whatsapp/messages';
    const paddingHeaders = payload.zenviaHeaders || payload.Headers || payload.headers || {};
    
    if (!nps_id || !conversa_id || !from || !to || !zenviaToken) {
      throw new BadRequestException('Campos obrigatórios ausentes: nps_id, conversa_id, from, to, zenviaToken.');
    }

    const sourceItens = payload.itens ?? payload.mensagens ?? [];
    const itens = sourceItens.map((raw, idx) => {
      const tipo = this.normalizeTipo(raw.tipo);
      const { opcoes: opcoesValidacao, mensagemInvalida, mensagemExpiracao } = this.extrairOpcoesValidacaoDoObjeto(raw.opcoes_validacao ?? raw.opcoesValidacao);
      return {
        id: raw.id ?? idx,
        ordem: this.toNumberOrNull(raw.ordem) ?? idx,
        tipo,
        mensagem: this.toStringOrNull(raw.texto) || this.toStringOrNull(raw.mensagem) || '',
        opcoesValidacao,
        mensagemInvalida,
        mensagemExpiracao,
        exigeResposta: tipo !== 'encerramento',
        resposta: null,
      } as ItemResposta;
    }).sort((a, b) => a.ordem - b.ordem);

    const tempoExpiracaoMinutos = this.toNumberOrNull(payload.tempo_expiracao_minutos ?? payload.tempoExpiracaoMinutos);
    const tempoExpiracaoMs = tempoExpiracaoMinutos && tempoExpiracaoMinutos > 0 ? tempoExpiracaoMinutos * 60 * 1000 : null;

    return {
      nps_id,
      conversa_id,
      from,
      to,
      itens,
      zenviaToken,
      zenviaBaseUrl,
      tempoExpiracaoMs,
      callbackUrl: this.toStringOrNull(payload.callbackUrl),
      callbackHeaders: payload.callbackHeaders || {},
      zenviaHeaders: paddingHeaders,
    };
  }

  private mapearParaDynamicFlow(itens: ItemResposta[]) {
    const states: Record<string, any> = {};
    const transitions: Record<string, any> = {};

    itens.forEach((item, idx) => {
      const stateId = idx === 0 ? 'INICIO' : `STEP_${idx}`;
      const nextState = idx === itens.length - 1 ? 'END' : (idx === 0 ? 'STEP_1' : `STEP_${idx + 1}`);

      let handler = '_handlerCapturar';
      let config: any = {
        mensagemPedir: item.mensagem,
        campoSalvar: `item_${idx}_ans`,
        transicaoAutomatica: true,
      };

      if (item.tipo === 'botao') {
        handler = '_handlerBotoes';
        config.titulo = item.mensagem;
        config.botoes = item.opcoesValidacao.map(o => ({ id: o, title: o }));
      } else if (item.tipo === 'lista') {
        handler = '_handlerLista';
        config.titulo = item.mensagem;
        config.opcoes = item.opcoesValidacao.map(o => ({ id: o, title: o }));
      } else if (item.tipo === 'encerramento') {
        handler = '_handlerMensagem';
        config.mensagens = [item.mensagem];
        config.transicaoAutomatica = true;
      }

      if (item.mensagemInvalida) config.mensagemInvalida = item.mensagemInvalida;
      if (item.mensagemExpiracao) config.mensagemExpiracao = item.mensagemExpiracao;

      states[stateId] = { handler, descricao: `Etapa ${idx + 1}`, config };
      transitions[stateId] = this.criarTransicoesPorValidacao(item.opcoesValidacao, nextState, item.opcoesValidacao.length === 0 || item.tipo === 'descritiva');
    });

    states['END'] = { handler: '_handlerMensagem', config: { mensagens: [], aguardarEntrada: false } };
    return { states, transitions };
  }

  private criarTransicoesPorValidacao(opcoes: string[], nextState: string, aceitaTudo: boolean) {
    if (aceitaTudo) return [{ entrada: '*', estadoDestino: nextState }];
    const t = opcoes.map(o => ({ entrada: this.normalizeEntrada(o), estadoDestino: nextState }));
    return t;
  }

  private extrairStringPath(obj: unknown, path: Array<string | number>): string | null {
    let atual: any = obj;
    for (const key of path) {
      if (!atual || typeof atual !== 'object') return null;
      atual = atual[key];
    }
    return typeof atual === 'string' ? atual : null;
  }

  private normalizarWebhook(body: unknown): NormalizedInbound | null {
    if (!this.isRecord(body)) return null;
    const firstMsg = Array.isArray(body.messages) ? body.messages[0] : null;
    const from = this.toStringOrNull(body.from) || 
                 this.extrairStringPath(body.message, ['from']) || 
                 this.extrairStringPath(firstMsg, ['from']);

    const to = this.toStringOrNull(body.to) || 
               this.extrairStringPath(body.message, ['to']) || 
               this.extrairStringPath(firstMsg, ['to']);

    const text = this.extrairStringPath(body, ['message', 'contents', 0, 'text']) || 
                 this.extrairStringPath(firstMsg, ['contents', 0, 'text']) ||
                 this.extrairStringPath(body, ['message', 'contents', 0, 'payload']) ||
                 this.extrairStringPath(firstMsg, ['contents', 0, 'payload']);

    const nps_id = this.toStringOrNull(body.nps_id) || 
                   this.toStringOrNull(this.extrairStringPath(body, ['message', 'nps_id'])) ||
                   this.toStringOrNull(this.extrairStringPath(firstMsg, ['nps_id']));

    if (!from || !to || !text) return null;
    return { from, to, text, nps_id, sourceType: 'text' };
  }

  async iniciarFluxo(body: unknown, query?: StartQueryInput) {
    const input = this.normalizeStartInput(body, query);
    const chatId = `zenvia:${input.nps_id}`;
    const flow = this.mapearParaDynamicFlow(input.itens);

    const sessaoData = {
      estado: 'INICIO',
      ultimaAtividadeEm: this.nowIso(),
      dynamic_states: flow.states,
      dynamic_transitions: flow.transitions,
      meta: {
        channel: 'zenvia',
        nps_id: input.nps_id,
        conversa_id: input.conversa_id,
        from: input.from,
        to: input.to,
        zenviaToken: input.zenviaToken,
        zenviaBaseUrl: input.zenviaBaseUrl,
        zenviaHeaders: input.zenviaHeaders,
        callbackUrl: input.callbackUrl,
        callbackHeaders: input.callbackHeaders,
        tempoExpiracaoMs: input.tempoExpiracaoMs,
      }
    };

    await this.redis.set(`session:${chatId}`, JSON.stringify(sessaoData), 'EX', 604800);
    const pair = this.normalizarPar(input.from, input.to);
    await this.redis.set(`zenvia:pair:${pair}`, input.nps_id, 'EX', 604800);

    this.handlerZenvia.setContext({
      from: input.from,
      to: input.to,
      token: input.zenviaToken,
      baseUrl: input.zenviaBaseUrl,
      headers: input.zenviaHeaders,
    });

    const mockMessage: any = {
      chatId, // Anexa o ID da sessão para rastreio no Handler
      from: input.to, // O celular do usuário
      to: input.from,  // O celular da operação
      body: '',
      type: 'chat',
      sender: { pushname: 'NPS' }
    };

    await this.engine.process(mockMessage, chatId, '', null, this.handlerZenvia);

    return { ok: true, nps_id: input.nps_id, chatId };
  }

  async processarWebhook(body: unknown) {
    const inbound = this.normalizarWebhook(body);
    if (!inbound) return { ok: false, reason: 'unsupported_format' };

    const pair = this.normalizarPar(inbound.from, inbound.to);
    let nps_id = inbound.nps_id || (await this.redis.get(`zenvia:pair:${pair}`));
    if (!nps_id) return { ok: false, reason: 'no_active_session' };

    const chatId = `zenvia:${nps_id}`;
    const rawSessao = await this.redis.get(`session:${chatId}`);
    if (rawSessao) {
      const sessao = JSON.parse(rawSessao);
      this.handlerZenvia.setContext({
        from: sessao.meta.from,
        to: sessao.meta.to,
        token: sessao.meta.zenviaToken,
        baseUrl: sessao.meta.zenviaBaseUrl,
        headers: sessao.meta.zenviaHeaders,
      });
    }

    const messageForEngine = {
      ...(typeof body === 'object' ? body : {}),
      from: inbound.from,
      to: inbound.to,
      chatId: chatId,
    };

    await this.engine.process(messageForEngine, chatId, inbound.text, null, this.handlerZenvia);

    const estadoFinal = await this.estadoRepo.obterEstadoUsuario(chatId);
    if (estadoFinal === 'END') {
      await this.finalizarFluxoUnificado(chatId);
    }

    return { ok: true, nps_id };
  }

  private async finalizarFluxoUnificado(chatId: string) {
    const sessaoRaw = await this.redis.get(`session:${chatId}`);
    if (!sessaoRaw) return;
    const sessao = JSON.parse(sessaoRaw);
    const meta = sessao.meta;
    const dados = this.engine.obterDados(chatId);

    const respostas = Object.keys(dados)
      .filter(k => k.startsWith('item_'))
      .map(k => ({ chave: k, resposta: dados[k] }));

    if (meta.callbackUrl) {
      await fetch(meta.callbackUrl, {
        method: 'POST',
        headers: { ...meta.callbackHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nps_id: meta.nps_id,
          conversa_id: meta.conversa_id,
          status: 'completed',
          respostas,
        }),
      }).catch(e => this.logger.error(`Erro callback: ${e}`));
    }

    const pair = this.normalizarPar(meta.from, meta.to);
    await this.redis.del(`session:${chatId}`);
    await this.redis.del(`zenvia:pair:${pair}`);
    this.engine.limparDados(chatId);
  }

  async encerrarSessao(nps_id: string) {
    const chatId = `zenvia:${nps_id}`;
    await this.finalizarFluxoUnificado(chatId);
    return { ok: true, nps_id, mensagem: 'encerrada' };
  }

  async listarSessoesAtivas() {
    const keys = await this.redis.keys('session:zenvia:*');
    const result: any[] = [];
    for (const key of keys) {
      const raw = await this.redis.get(key);
      if (raw) {
        const s = JSON.parse(raw);
        
        // Calcula progresso: extrai o número de STEP_N
        const matchStep = (s.estado || '').match(/STEP_(\d+)/);
        const currentIndex = matchStep ? parseInt(matchStep[1], 10) : 0;
        
        // Conta total de etapas (ignorando o estado 'END')
        const totalItens = Object.keys(s.dynamic_states || {}).filter(k => k.startsWith('STEP_')).length;

        result.push({
          nps_id: s.meta?.nps_id,
          from: s.meta?.from,
          to: s.meta?.to,
          estado: s.estado,
          ultimaAtividadeEm: s.ultimaAtividadeEm,
          tempoExpiracaoMs: s.meta?.tempoExpiracaoMs ?? null,
          currentIndex,
          totalItens,
        });
      }
    }
    return result;
  }

  private async limparExpiradas() {
    await this.idleExpiration.verificarTodosOciosos();
  }

  async atualizarTempoExpiracao(nps_id: string, minutos: number | null) {
    const chatId = `zenvia:${nps_id}`;
    const raw = await this.redis.get(`session:${chatId}`);
    if (!raw) throw new NotFoundException('Sessão não encontrada.');
    const sessao = JSON.parse(raw);
    sessao.meta.tempoExpiracaoMs = minutos && minutos > 0 ? minutos * 60 * 1000 : null;
    await this.redis.set(`session:${chatId}`, JSON.stringify(sessao), 'EX', 604800);
    return { ok: true, nps_id, tempoExpiracaoMs: sessao.meta.tempoExpiracaoMs };
  }
}
