import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Client, TextContent } from '@zenvia/sdk';
import { HandlerService } from '../wppConnect/handler.service';
import { StateMachineEngine } from '../state-machine.engine';
import { MEMORY_SESSIONS } from '../meta/default-state-machine.config';

type PrimitiveId = string | number;

type InputItem = {
  id?: PrimitiveId;
  ordem?: number;
  tipo?: string;
  texto?: string;
  opcoes_validacao?: string | null;
  opcoesValidacao?: string | null;
  mensagem?: string;
};

type ItemResposta = {
  id: PrimitiveId;
  ordem: number;
  tipo: string;
  mensagem: string;
  opcoesValidacao: string[];
  exigeResposta: boolean;
  resposta: string | null;
  perguntaMessageId: string | null;
  perguntaProviderResponse: unknown | null;
  respostaMessageId: string | null;
  respondidoEm: string | null;
};

type SessaoStatus = 'active' | 'completed';

type EstadoConfigMemoria = {
  handler: string;
  descricao: string;
  config: Record<string, unknown>;
};

type TransicaoMemoria = {
  entrada: string;
  estadoDestino: string;
};

class ZenviaEstadoRepoMemoria {
  private readonly estadoInicial: string;
  private readonly configs = new Map<string, EstadoConfigMemoria>();
  private readonly transicoes = new Map<string, TransicaoMemoria[]>();
  private readonly estadosUsuarios = new Map<string, string>();

  constructor(args: {
    estadoInicial: string;
    configs: Map<string, EstadoConfigMemoria>;
    transicoes: Map<string, TransicaoMemoria[]>;
  }) {
    this.estadoInicial = args.estadoInicial;
    this.configs = args.configs;
    this.transicoes = args.transicoes;
  }

  getEstadoInicialSync(): string {
    return this.estadoInicial;
  }

  async obterConfigEstado(estado: string): Promise<EstadoConfigMemoria | null> {
    return this.configs.get(estado) ?? null;
  }

  async buscarProximoEstado(
    estadoAtual: string,
    entrada: string,
    acceptWildcard = true,
  ): Promise<string | null> {
    const lista = this.transicoes.get(estadoAtual) ?? [];
    const exata = lista.find((t) => t.entrada === entrada);
    if (exata) return exata.estadoDestino;

    if (acceptWildcard && entrada !== '*') {
      const coringa = lista.find((t) => t.entrada === '*');
      if (coringa) return coringa.estadoDestino;
    }

    return null;
  }

  async obterEstadoUsuario(chatId: string): Promise<string | null> {
    return this.estadosUsuarios.get(chatId) ?? null;
  }

  async salvarEstadoUsuario(chatId: string, estado: string): Promise<void> {
    this.estadosUsuarios.set(chatId, estado);
  }

  async registrarTransicao(): Promise<void> {
    return;
  }

  async obterEstadoInicial(): Promise<string> {
    return this.estadoInicial;
  }

  async obterVariaveisFluxoAtivo(): Promise<Record<string, string>> {
    return {};
  }

  async obterRotaApi(): Promise<null> {
    return null;
  }
}

type SessaoRuntime = {
  repo: ZenviaEstadoRepoMemoria;
  engine: StateMachineEngine;
  handler: HandlerService;
  chatId: string;
  messageContext: { from: string };
  stateToIndex: Map<string, number>;
  promptStateToIndex: Map<string, number>;
  responseKeyByIndex: string[];
  responseRequiredIndexes: Set<number>;
};

type SessaoMemoria = {
  executionId: string;
  from: string;
  to: string;
  status: SessaoStatus;
  currentIndex: number;
  itens: ItemResposta[];
  callbackUrl: string | null;
  callbackHeaders: Record<string, string>;
  npsHeaders: Record<string, string>;
  zenviaToken: string;
  zenviaBaseUrl: string;
  zenviaHeaders: Record<string, string>;
  webhookSecret: string | null;
  encerramentoExecutado: boolean;
  encerramentoExecutadoEm: string | null;
  resultadoNpsEnviado: boolean;
  npsPrimeiraTentativaEm: string | null;
  npsUltimaTentativaEm: string | null;
  npsEmEnvio: boolean;
  criadoEm: string;
  atualizadoEm: string;
  runtime: SessaoRuntime;
};

type StartInput = {
  executionId?: string;
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
};

type NormalizedInbound = {
  from: string;
  to: string;
  text: string;
  executionId: string | null;
};

type FetchJsonResult = {
  messageId: string | null;
  payload: unknown;
};

type StartQueryInput = {
  to?: string;
  from?: string;
  token?: string;
  baseUrl?: string;
  webhookSecret?: string;
  executionId?: string;
};

@Injectable()
export class ZenviaService implements OnModuleDestroy {
  private readonly logger = new Logger(ZenviaService.name);
  private readonly sessoes = new Map<string, SessaoMemoria>();
  private readonly sessoesAtivasPorPar = new Map<string, string>();
  private readonly ttlMs = 1000 * 60 * 60 * 12;
  private readonly npsMaxRetryMs = 1000 * 60 * 60 * 24;
  private readonly cleanupTimer: NodeJS.Timeout;
  private readonly npsEndpointUrl =
    process.env.ZENVIA_NPS_ENDPOINT_URL ??
    'http://localhost/homologation-api-chatboot-proxy/chatboot/salvaRespostaNps';
  private readonly npsApplicationKey =
    process.env.ZENVIA_NPS_APPLICATION_KEY ??
    '9a2a4e71f8457120000d1258d663119c12637315';

  constructor() {
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
    return `${from.trim()}::${to.trim()}`;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private maskPhone(phone: string | null | undefined): string {
    if (!phone) return 'null';
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return 'invalid';
    if (digits.length <= 4) return `${digits[0] ?? '*'}***`;
    return `${digits.slice(0, 4)}***${digits.slice(-2)}`;
  }

  private maskToken(token: string | null | undefined): string {
    if (!token) return 'null';
    const clean = token.trim().replace(/^"(.*)"$/, '$1');
    if (clean.length <= 6) return `${clean.slice(0, 1)}***`;
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

  private getHeaderCaseInsensitive(
    headers: Record<string, string>,
    name: string,
  ): string | null {
    const target = name.toLowerCase();
    for (const [k, v] of Object.entries(headers || {})) {
      if (k.toLowerCase() === target) return String(v);
    }
    return null;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private normalizeTipo(value: unknown): string {
    const tipo = this.toStringOrNull(value)?.toLowerCase() ?? 'descritiva';
    if (
      tipo === 'botao' ||
      tipo === 'numerica' ||
      tipo === 'lista' ||
      tipo === 'descritiva' ||
      tipo === 'encerramento'
    ) {
      return tipo;
    }
    return 'descritiva';
  }

  private normalizeEntrada(value: string): string {
    return value.trim().toLowerCase();
  }

  private parseOpcoesValidacao(value: unknown): string[] {
    if (value === null || value === undefined) return [];

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
          if (span <= 200) {
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

    const unique = new Set<string>();
    for (const p of parts) {
      const clean = String(p).trim();
      if (clean) unique.add(clean);
    }
    return Array.from(unique);
  }

  private tipoExigeResposta(tipo: string): boolean {
    return tipo !== 'encerramento';
  }

  private normalizeStartInput(
    body: unknown,
    query?: StartQueryInput,
  ): {
    executionId: string;
    from: string;
    to: string;
    itens: ItemResposta[];
    callbackUrl: string | null;
    callbackHeaders: Record<string, string>;
    npsHeaders: Record<string, string>;
    zenviaToken: string;
    zenviaBaseUrl: string;
    zenviaHeaders: Record<string, string>;
    webhookSecret: string | null;
  } {
    let payload: StartInput = {};

    if (Array.isArray(body)) {
      payload.itens = body as InputItem[];
    } else if (this.isRecord(body)) {
      payload = body as StartInput;
    } else {
      throw new BadRequestException('Body inválido para iniciar fluxo Zenvia.');
    }

    const executionId =
      this.toStringOrNull(query?.executionId) ||
      this.toStringOrNull(payload.executionId);
    const from =
      this.toStringOrNull(query?.from) ||
      this.toStringOrNull(payload.from) ||
      this.toStringOrNull(payload.ZENVIA_WHATSAPP_FROM);
    const to = this.toStringOrNull(query?.to) || this.toStringOrNull(payload.to);
    const sourceItens = payload.itens ?? payload.mensagens ?? [];
    const zenviaToken =
      this.toStringOrNull(query?.token) ||
      this.toStringOrNull(payload.zenviaToken) ||
      this.toStringOrNull(payload.ZENVIA_TOKEN);
    const zenviaBaseUrl =
      this.toStringOrNull(query?.baseUrl) ||
      this.toStringOrNull(payload.zenviaBaseUrl) ||
      this.toStringOrNull(payload.ZENVIA_BASE_URL) ||
      'https://api.zenvia.com/v2/channels/whatsapp/messages';
    const webhookSecret =
      this.toStringOrNull(query?.webhookSecret) ||
      this.toStringOrNull(payload.zenviaWebhookSecret) ||
      this.toStringOrNull(payload.ZENVIA_WEBHOOK_SECRET);
    const zenviaHeaders =
      payload.zenviaHeaders && this.isRecord(payload.zenviaHeaders)
        ? Object.fromEntries(
            Object.entries(payload.zenviaHeaders).map(([k, v]) => [
              k,
              String(v),
            ]),
          )
        : {};
    const npsHeadersFonte =
      (payload.Headers && this.isRecord(payload.Headers) && payload.Headers) ||
      (payload.headers && this.isRecord(payload.headers) && payload.headers) ||
      {};
    const npsHeaders = Object.fromEntries(
      Object.entries(npsHeadersFonte).map(([k, v]) => [k, String(v)]),
    );

    if (!executionId) {
      throw new BadRequestException(
        'executionId é obrigatório. Envie "executionId" no body ou query.',
      );
    }

    if (!from) {
      throw new BadRequestException(
        'Número de origem ausente. Envie "from" ou "ZENVIA_WHATSAPP_FROM".',
      );
    }

    if (!to) {
      throw new BadRequestException(
        'Número de destino ausente. Envie "to" no body ou query.',
      );
    }

    if (!zenviaToken) {
      throw new BadRequestException(
        'Token Zenvia ausente. Envie "zenviaToken" (ou "ZENVIA_TOKEN") no body.',
      );
    }

    if (!Array.isArray(sourceItens) || sourceItens.length === 0) {
      throw new BadRequestException(
        'Lista de mensagens obrigatória e não pode ser vazia.',
      );
    }

    const itens = sourceItens
      .map((raw, idx) => {
        const ordem = this.toNumberOrNull(raw?.ordem) ?? idx;
        const tipo = this.normalizeTipo(raw?.tipo);
        const mensagem =
          this.toStringOrNull(raw?.texto) || this.toStringOrNull(raw?.mensagem);
        const id = ordem;
        const opcoesValidacao = this.parseOpcoesValidacao(
          raw?.opcoes_validacao ?? raw?.opcoesValidacao,
        );
        const exigeResposta = this.tipoExigeResposta(tipo);

        if (!mensagem) {
          throw new BadRequestException(
            `Item ${idx + 1} sem campo "texto" (ou "mensagem") válido.`,
          );
        }

        return {
          id,
          ordem,
          tipo,
          mensagem,
          opcoesValidacao,
          exigeResposta,
          resposta: null,
          perguntaMessageId: null,
          perguntaProviderResponse: null,
          respostaMessageId: null,
          respondidoEm: null,
        } as ItemResposta;
      })
      .sort((a, b) => a.ordem - b.ordem);

    const ordensVistas = new Set<number>();
    for (const item of itens) {
      if (ordensVistas.has(item.ordem)) {
        throw new BadRequestException(
          `Valor "ordem" duplicado: ${item.ordem}. Cada etapa deve ter ordem única.`,
        );
      }
      ordensVistas.add(item.ordem);
    }

    const callbackUrl = this.toStringOrNull(payload.callbackUrl);
    const callbackHeaders =
      payload.callbackHeaders && this.isRecord(payload.callbackHeaders)
        ? Object.fromEntries(
            Object.entries(payload.callbackHeaders).map(([k, v]) => [
              k,
              String(v),
            ]),
          )
        : {};

    return {
      executionId,
      from,
      to,
      itens,
      callbackUrl,
      callbackHeaders,
      npsHeaders,
      zenviaToken,
      zenviaBaseUrl,
      zenviaHeaders,
      webhookSecret,
    };
  }

  private extrairString(obj: unknown, path: Array<string | number>): string | null {
    let atual: unknown = obj;
    for (const key of path) {
      if (typeof key === 'number') {
        if (!Array.isArray(atual) || key >= atual.length) return null;
        atual = atual[key];
        continue;
      }
      if (!this.isRecord(atual)) return null;
      atual = atual[key];
    }
    return this.toStringOrNull(atual);
  }

  private normalizarWebhook(body: unknown): NormalizedInbound | null {
    if (!this.isRecord(body)) return null;

    const firstMessage = Array.isArray(body.messages) ? body.messages[0] : null;

    const from =
      this.toStringOrNull(body.from) ||
      this.extrairString(body, ['message', 'from']) ||
      this.extrairString(firstMessage, ['from']);

    const to =
      this.toStringOrNull(body.to) ||
      this.extrairString(body, ['message', 'to']) ||
      this.extrairString(firstMessage, ['to']);

    const text =
      this.extrairString(body, ['text']) ||
      this.extrairString(body, ['message', 'text']) ||
      this.extrairString(body, ['message', 'contents', 0, 'text']) ||
      this.extrairString(firstMessage, ['text']) ||
      this.extrairString(firstMessage, ['contents', 0, 'text']) ||
      this.extrairString(body, ['content', 'text']);

    if (!from || !to || !text) return null;

    const executionId =
      this.extrairString(body, ['executionId']) ||
      this.extrairString(body, ['metadata', 'executionId']) ||
      this.extrairString(body, ['message', 'metadata', 'executionId']) ||
      this.extrairString(firstMessage, ['metadata', 'executionId']);

    return { from, to, text, executionId };
  }

  private async enviarMensagemViaSdk(
    from: string,
    to: string,
    mensagem: string,
    tokenLimpo: string,
  ): Promise<FetchJsonResult> {
    this.logger.log(
      `[Zenvia][SDK][attempt] from=${this.maskPhone(from)} to=${this.maskPhone(to)} token=${this.maskToken(tokenLimpo)} textLen=${mensagem.length}`,
    );
    const tempClient = new Client(tokenLimpo);
    const whatsappChannel = tempClient.getChannel('whatsapp');
    const content = new TextContent(mensagem);
    const response = await whatsappChannel.sendMessage(from, to, content);

    const messageId =
      this.extrairString(response, ['id']) ||
      this.extrairString(response, ['messageId']) ||
      this.extrairString(response, ['messages', 0, 'id']);

    this.logger.log(
      `[Zenvia][SDK][success] from=${this.maskPhone(from)} to=${this.maskPhone(to)} messageId=${messageId ?? 'null'} payload=${this.stringifySafe(response)}`,
    );

    return { messageId, payload: response };
  }

  private async enviarMensagemViaHttp(
    from: string,
    to: string,
    mensagem: string,
    tokenLimpo: string,
    zenviaBaseUrl: string,
    zenviaHeaders: Record<string, string>,
  ): Promise<FetchJsonResult> {
    const payload = {
      from,
      to,
      contents: [{ type: 'text', text: mensagem }],
    };

    this.logger.log(
      `[Zenvia][HTTP][attempt] url=${zenviaBaseUrl} from=${this.maskPhone(from)} to=${this.maskPhone(to)} token=${this.maskToken(tokenLimpo)} headers=${this.stringifySafe(this.maskHeaders(zenviaHeaders))} textLen=${mensagem.length}`,
    );

    const res = await fetch(zenviaBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-TOKEN': tokenLimpo,
        Authorization: `Bearer ${tokenLimpo}`,
        ...zenviaHeaders,
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as unknown;
    if (!res.ok) {
      this.logger.error(
        `[Zenvia][HTTP][error] status=${res.status} from=${this.maskPhone(from)} to=${this.maskPhone(to)} payload=${this.stringifySafe(json)}`,
      );
      throw new BadRequestException('Falha ao enviar mensagem via Zenvia.');
    }

    const messageId =
      this.extrairString(json, ['id']) ||
      this.extrairString(json, ['messages', 0, 'id']) ||
      this.extrairString(json, ['message', 'id']);

    this.logger.log(
      `[Zenvia][HTTP][success] status=${res.status} from=${this.maskPhone(from)} to=${this.maskPhone(to)} messageId=${messageId ?? 'null'} payload=${this.stringifySafe(json)}`,
    );

    return { messageId, payload: json };
  }

  private async enviarMensagem(
    from: string,
    to: string,
    mensagem: string,
    zenviaToken: string,
    zenviaBaseUrl: string,
    zenviaHeaders: Record<string, string>,
  ): Promise<FetchJsonResult> {
    const tokenLimpo = zenviaToken.trim().replace(/^"(.*)"$/, '$1');

    this.logger.log(
      `[Zenvia][SEND][start] from=${this.maskPhone(from)} to=${this.maskPhone(to)} token=${this.maskToken(tokenLimpo)} baseUrl=${zenviaBaseUrl}`,
    );

    try {
      return await this.enviarMensagemViaSdk(from, to, mensagem, tokenLimpo);
    } catch (sdkErr: unknown) {
      const sdkMsg = this.errorToString(sdkErr);
      this.logger.warn(
        `[Zenvia][SEND][sdk-failed] ${sdkMsg}. Tentando fallback HTTP.`,
      );
      return this.enviarMensagemViaHttp(
        from,
        to,
        mensagem,
        tokenLimpo,
        zenviaBaseUrl,
        zenviaHeaders,
      );
    }
  }

  private criarTransicoesPorValidacao(
    opcoes: string[],
    estadoDestino: string,
    fallbackWildcard = false,
  ): TransicaoMemoria[] {
    const transicoes = opcoes
      .map((opcao) => this.normalizeEntrada(opcao))
      .filter((entrada) => !!entrada)
      .map((entrada) => ({ entrada, estadoDestino }));

    if (transicoes.length === 0 || fallbackWildcard) {
      transicoes.push({ entrada: '*', estadoDestino });
    }

    return transicoes;
  }

  private criarOpcoesInterativas(opcoes: string[]) {
    return opcoes.map((opcao) => ({
      entrada: this.normalizeEntrada(opcao),
      label: opcao,
      descricao: '',
    }));
  }

  private criarRuntime(sessao: Omit<SessaoMemoria, 'runtime'>): SessaoRuntime {
    const configs = new Map<string, EstadoConfigMemoria>();
    const transicoes = new Map<string, TransicaoMemoria[]>();
    const stateToIndex = new Map<string, number>();
    const promptStateToIndex = new Map<string, number>();
    const responseKeyByIndex: string[] = [];
    const responseRequiredIndexes = new Set<number>();

    for (let idx = 0; idx < sessao.itens.length; idx++) {
      const item = sessao.itens[idx];
      const stepState = `STEP_${idx + 1}`;
      const nextState = idx + 1 < sessao.itens.length ? `STEP_${idx + 2}` : 'END';
      const responseKey = `resp_${String(item.id)}`;
      const tipo = this.normalizeTipo(item.tipo);

      stateToIndex.set(stepState, idx);
      responseKeyByIndex[idx] = responseKey;

      if (item.exigeResposta) {
        promptStateToIndex.set(stepState, idx);
        responseRequiredIndexes.add(idx);
      }

      if (tipo === 'encerramento') {
        configs.set(stepState, {
          handler: '_handlerMensagem',
          descricao: `Encerramento ${idx + 1}`,
          config: {
            mensagens: [item.mensagem],
            transicaoAutomatica: true,
          },
        });
        transicoes.set(stepState, [{ entrada: '*', estadoDestino: nextState }]);
        continue;
      }

      if (tipo === 'botao') {
        const botoes = this.criarOpcoesInterativas(item.opcoesValidacao);
        configs.set(stepState, {
          handler: '_handlerBotoes',
          descricao: `Botao ${idx + 1}`,
          config: {
            titulo: item.mensagem,
            botoes,
            mensagemInvalida:
              item.opcoesValidacao.length > 0
                ? `Opcao invalida. Escolha uma das opcoes: ${item.opcoesValidacao.join(', ')}.`
                : 'Opcao invalida.',
          },
        });
        transicoes.set(
          stepState,
          this.criarTransicoesPorValidacao(
            item.opcoesValidacao,
            nextState,
            item.opcoesValidacao.length === 0,
          ),
        );
        continue;
      }

      if (tipo === 'lista') {
        const opcoes = this.criarOpcoesInterativas(item.opcoesValidacao);
        configs.set(stepState, {
          handler: '_handlerLista',
          descricao: `Lista ${idx + 1}`,
          config: {
            titulo: item.mensagem,
            opcoes,
            botaoTexto: 'Selecionar',
            secaoTitulo: 'Opcoes',
            mensagemInvalida:
              item.opcoesValidacao.length > 0
                ? `Opcao invalida. Escolha uma das opcoes: ${item.opcoesValidacao.join(', ')}.`
                : 'Opcao invalida.',
          },
        });
        transicoes.set(
          stepState,
          this.criarTransicoesPorValidacao(
            item.opcoesValidacao,
            nextState,
            item.opcoesValidacao.length === 0,
          ),
        );
        continue;
      }

      configs.set(stepState, {
        handler: '_handlerCapturar',
        descricao: `Captura ${idx + 1}`,
        config: {
          mensagemPedir: item.mensagem,
          campoSalvar: responseKey,
          transicaoAutomatica: true,
          mensagemInvalida:
            item.opcoesValidacao.length > 0
              ? `Resposta invalida. Valores aceitos: ${item.opcoesValidacao.join(', ')}.`
              : 'Resposta invalida. Tente novamente.',
        },
      });
      transicoes.set(
        stepState,
        this.criarTransicoesPorValidacao(
          item.opcoesValidacao,
          nextState,
          item.opcoesValidacao.length === 0,
        ),
      );
    }

    configs.set('END', {
      handler: '_handlerMensagem',
      descricao: 'Fim',
      config: {
        mensagens: [],
        transicaoAutomatica: false,
        aguardarEntrada: true,
      },
    });

    const repo = new ZenviaEstadoRepoMemoria({
      estadoInicial: 'STEP_1',
      configs,
      transicoes,
    });

    MEMORY_SESSIONS[sessao.executionId] = {
      nome: `Zenvia Flow - ${sessao.executionId.split('-')[0]}`,
      configs: Object.fromEntries(configs.entries()),
      transicoes: Object.fromEntries(transicoes.entries()) as any,
    };

    const engine = new StateMachineEngine(repo as never, {
      buscarKeywordAtiva: async () => null,
    } as never);

    const handler = new HandlerService(repo as never);
    const chatId = `zenvia:${sessao.executionId}`;
    const messageContext = { from: `${sessao.to}@zenvia` };

    handler.client = {
      sendText: async (_destino: string, texto: string) => {
        const estadoAtual =
          engine.estadosUsuarios.get(chatId) ?? repo.getEstadoInicialSync();
        const idx = stateToIndex.get(estadoAtual);
        const item = typeof idx === 'number' ? sessao.itens[idx] : null;
        this.logger.log(
          `[Zenvia][FLOW][sendText] executionId=${sessao.executionId} estado=${estadoAtual} idx=${typeof idx === 'number' ? idx : 'null'} itemId=${item ? String(item.id) : 'null'} from=${this.maskPhone(sessao.from)} to=${this.maskPhone(sessao.to)} text=${this.stringifySafe(texto, 500)}`,
        );

        const sent = await this.enviarMensagem(
          sessao.from,
          sessao.to,
          texto,
          sessao.zenviaToken,
          sessao.zenviaBaseUrl,
          sessao.zenviaHeaders,
        );

        if (item && !item.perguntaMessageId) {
          item.perguntaMessageId = sent.messageId;
          item.perguntaProviderResponse = sent.payload;
        }

        if (item?.tipo === 'encerramento') {
          sessao.encerramentoExecutado = true;
          if (!sessao.encerramentoExecutadoEm) {
            sessao.encerramentoExecutadoEm = this.nowIso();
          }
        }

        this.logger.log(
          `[Zenvia][FLOW][sendText:done] executionId=${sessao.executionId} estado=${estadoAtual} messageId=${sent.messageId ?? 'null'}`,
        );
      },
    };

    engine.estadosUsuarios.set(chatId, repo.getEstadoInicialSync());

    return {
      repo,
      engine,
      handler,
      chatId,
      messageContext,
      stateToIndex,
      promptStateToIndex,
      responseKeyByIndex,
      responseRequiredIndexes,
    };
  }

  private atualizarStatusSessao(sessao: SessaoMemoria) {
    const respondidas = sessao.itens.filter(
      (item, idx) =>
        sessao.runtime.responseRequiredIndexes.has(idx) && item.resposta !== null,
    ).length;
    const totalEsperadas = sessao.runtime.responseRequiredIndexes.size;
    sessao.currentIndex = respondidas;
    if (totalEsperadas === 0 || respondidas >= totalEsperadas) {
      sessao.status = 'completed';
      this.sessoesAtivasPorPar.delete(this.normalizarPar(sessao.from, sessao.to));
    } else {
      sessao.status = 'active';
    }
    sessao.atualizadoEm = this.nowIso();
  }

  private getPublicSnapshot(sessao: SessaoMemoria) {
    return {
      executionId: sessao.executionId,
      status: sessao.status,
      from: sessao.from,
      to: sessao.to,
      currentIndex: sessao.currentIndex,
      criadoEm: sessao.criadoEm,
      atualizadoEm: sessao.atualizadoEm,
      itens: sessao.itens.map((item) => ({
        ordem: item.ordem,
        mensagem: item.mensagem,
        resposta: item.resposta,
        perguntaMessageId: item.perguntaMessageId,
        perguntaProviderResponse: item.perguntaProviderResponse,
        respostaMessageId: item.respostaMessageId,
        respondidoEm: item.respondidoEm,
      })),
    };
  }

  private montarResultadoNps(sessao: SessaoMemoria) {
    return sessao.itens.map((item) => ({
      ordem: item.ordem,
      mensagem: item.mensagem,
      resposta: item.resposta,
    }));
  }

  private async enviarResultadoNps(sessao: SessaoMemoria, motivo: string) {
    if (!sessao.encerramentoExecutado) return;
    if (sessao.resultadoNpsEnviado) return;
    if (sessao.npsEmEnvio) return;

    const agoraIso = this.nowIso();
    if (!sessao.npsPrimeiraTentativaEm) {
      sessao.npsPrimeiraTentativaEm = agoraIso;
    }
    sessao.npsUltimaTentativaEm = agoraIso;
    sessao.npsEmEnvio = true;

    const payload = {
      executionId: sessao.executionId,
      respostas: this.montarResultadoNps(sessao),
    };

    const accessApplicationKey =
      this.getHeaderCaseInsensitive(
        sessao.npsHeaders,
        'Access-Application-Key',
      ) || this.npsApplicationKey;
    const celularOperacao =
      this.getHeaderCaseInsensitive(sessao.npsHeaders, 'celular_operacao') ||
      sessao.to;
    const accessEnv =
      this.getHeaderCaseInsensitive(sessao.npsHeaders, 'Access-Env') || null;

    const headers: Record<string, string> = {
      ...sessao.npsHeaders,
      'Content-Type': 'application/json',
      'Access-Application-Key': accessApplicationKey,
      celular_operacao: celularOperacao,
    };
    if (accessEnv) {
      headers['Access-Env'] = accessEnv;
    }

    try {
      const res = await fetch(this.npsEndpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const sucessoNps =
        res.status === 200 || res.status === 201 || res.status === 204;
      if (!sucessoNps) {
        const body = await res.text().catch(() => '');
        this.logger.warn(
          `[Zenvia][NPS][retry] executionId=${sessao.executionId} motivo=${motivo} status=${res.status} body=${this.stringifySafe(body, 800)}`,
        );
        return;
      }

      sessao.resultadoNpsEnviado = true;
      this.logger.log(
        `[Zenvia][NPS][sent] executionId=${sessao.executionId} motivo=${motivo} status=${res.status} endpoint=${this.npsEndpointUrl}`,
      );
      this.removerSessao(sessao.executionId, `nps-success-${res.status}`);
    } catch (err: unknown) {
      this.logger.warn(
        `[Zenvia][NPS][retry] executionId=${sessao.executionId} motivo=${motivo} erro=${this.errorToString(err)}`,
      );
    } finally {
      sessao.npsEmEnvio = false;
    }
  }

  private async iniciarFluxoOficial(sessao: SessaoMemoria): Promise<void> {
    this.logger.log(
      `[Zenvia][FLOW][start] executionId=${sessao.executionId} from=${this.maskPhone(sessao.from)} to=${this.maskPhone(sessao.to)} perguntas=${sessao.itens.length}`,
    );

    await sessao.runtime.repo.salvarEstadoUsuario(
      sessao.runtime.chatId,
      sessao.runtime.repo.getEstadoInicialSync(),
    );

    await sessao.runtime.engine.process(
      sessao.runtime.messageContext,
      sessao.runtime.chatId,
      '',
      null,
      sessao.runtime.handler,
    );

    this.atualizarStatusSessao(sessao);
    await this.enviarResultadoNps(sessao, 'start');
    this.logger.log(
      `[Zenvia][FLOW][started] executionId=${sessao.executionId} status=${sessao.status} currentIndex=${sessao.currentIndex}`,
    );
  }

  private async enviarCallback(sessao: SessaoMemoria, event: string) {
    if (!sessao.callbackUrl) return;
    try {
      await fetch(sessao.callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...sessao.callbackHeaders,
        },
        body: JSON.stringify({
          event,
          ...this.getPublicSnapshot(sessao),
        }),
      });
      this.logger.log(
        `[Zenvia][callback][success] executionId=${sessao.executionId} event=${event} callbackUrl=${sessao.callbackUrl}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Zenvia] Falha no callback (${event}): ${msg}`);
    }
  }

  private obterSecretRecebido(
    headers: Record<string, string>,
    body: unknown,
  ): string {
    const recebido =
      headers['x-zenvia-secret'] ||
      headers['x-webhook-secret'] ||
      (this.isRecord(body) ? this.toStringOrNull(body.zenviaWebhookSecret) : '') ||
      (this.isRecord(body) ? this.toStringOrNull(body.ZENVIA_WEBHOOK_SECRET) : '') ||
      '';
    return recebido;
  }

  private validarWebhookSecretSessao(
    sessao: SessaoMemoria,
    headers: Record<string, string>,
    body: unknown,
  ) {
    if (!sessao.webhookSecret) return;
    const recebido = this.obterSecretRecebido(headers, body);
    if (recebido !== sessao.webhookSecret) {
      this.logger.warn(
        `[Zenvia][webhook][secret-invalid] executionId=${sessao.executionId} recebido=${this.maskToken(recebido)} esperado=${this.maskToken(sessao.webhookSecret)}`,
      );
      throw new BadRequestException('Webhook Zenvia com segredo inválido.');
    }
    this.logger.log(
      `[Zenvia][webhook][secret-valid] executionId=${sessao.executionId}`,
    );
  }

  private removerSessao(executionId: string, reason = 'manual') {
    const sessao = this.sessoes.get(executionId);
    if (!sessao) return;
    this.sessoes.delete(executionId);
    this.sessoesAtivasPorPar.delete(this.normalizarPar(sessao.from, sessao.to));
    delete MEMORY_SESSIONS[executionId];
    this.logger.log(
      `[Zenvia][session][removed] executionId=${executionId} reason=${reason}`,
    );
  }

  private limparExpiradas() {
    const agora = Date.now();
    for (const [executionId, sessao] of this.sessoes.entries()) {
      if (sessao.encerramentoExecutado && !sessao.resultadoNpsEnviado) {
        const baseEncerramento =
          Date.parse(sessao.encerramentoExecutadoEm || sessao.atualizadoEm) || agora;
        const elapsedNps = agora - baseEncerramento;

        if (elapsedNps >= this.npsMaxRetryMs) {
          this.removerSessao(executionId, 'nps-timeout-24h');
          continue;
        }

        void this.enviarResultadoNps(sessao, 'retry-timer');
        continue;
      }

      const atualizacao = Date.parse(sessao.atualizadoEm);
      if (Number.isNaN(atualizacao)) continue;
      if (agora - atualizacao <= this.ttlMs) continue;

      this.removerSessao(executionId, 'expired-ttl');
    }
  }

  async iniciarFluxo(body: unknown, query?: StartQueryInput) {
    this.logger.log(
      `[Zenvia][start][request] bodyType=${Array.isArray(body) ? 'array' : typeof body} query=${this.stringifySafe(query)}`,
    );

    const normalized = this.normalizeStartInput(body, query);
    const pair = this.normalizarPar(normalized.from, normalized.to);

    this.logger.log(
      `[Zenvia][start][normalized] executionId=${normalized.executionId} from=${this.maskPhone(normalized.from)} to=${this.maskPhone(normalized.to)} perguntas=${normalized.itens.length} baseUrl=${normalized.zenviaBaseUrl} token=${this.maskToken(normalized.zenviaToken)} headers=${this.stringifySafe(this.maskHeaders(normalized.zenviaHeaders))} npsHeaders=${this.stringifySafe(this.maskHeaders(normalized.npsHeaders))} webhookSecret=${normalized.webhookSecret ? this.maskToken(normalized.webhookSecret) : 'null'}`,
    );

    const executionIdAtivo = this.sessoesAtivasPorPar.get(pair);
    if (executionIdAtivo) {
      this.logger.warn(
        `[Zenvia][start][blocked] par já ativo executionId=${executionIdAtivo} from=${this.maskPhone(normalized.from)} to=${this.maskPhone(normalized.to)}`,
      );
      throw new BadRequestException(
        `Já existe sessão ativa para este par. executionId=${executionIdAtivo}`,
      );
    }

    const executionId = normalized.executionId;
    if (this.sessoes.has(executionId)) {
      this.logger.warn(
        `[Zenvia][start][blocked] executionId já existente executionId=${executionId}`,
      );
      throw new BadRequestException(
        `executionId já existe e não pode ser reutilizado: ${executionId}`,
      );
    }
    const now = this.nowIso();

    const baseSessao = {
      executionId,
      from: normalized.from,
      to: normalized.to,
      status: 'active' as SessaoStatus,
      currentIndex: 0,
      itens: normalized.itens,
      callbackUrl: normalized.callbackUrl,
      callbackHeaders: normalized.callbackHeaders,
      npsHeaders: normalized.npsHeaders,
      zenviaToken: normalized.zenviaToken,
      zenviaBaseUrl: normalized.zenviaBaseUrl,
      zenviaHeaders: normalized.zenviaHeaders,
      webhookSecret: normalized.webhookSecret,
      encerramentoExecutado: false,
      encerramentoExecutadoEm: null,
      resultadoNpsEnviado: false,
      npsPrimeiraTentativaEm: null,
      npsUltimaTentativaEm: null,
      npsEmEnvio: false,
      criadoEm: now,
      atualizadoEm: now,
    };

    const runtime = this.criarRuntime(baseSessao);

    const sessao: SessaoMemoria = {
      ...baseSessao,
      runtime,
    };

    this.sessoes.set(executionId, sessao);
    this.sessoesAtivasPorPar.set(pair, executionId);
    this.logger.log(
      `[Zenvia][session][created] executionId=${executionId} from=${this.maskPhone(sessao.from)} to=${this.maskPhone(sessao.to)} perguntas=${sessao.itens.length}`,
    );

    try {
      await this.iniciarFluxoOficial(sessao);
      await this.enviarCallback(sessao, 'started');
    } catch (err) {
      this.sessoes.delete(executionId);
      this.sessoesAtivasPorPar.delete(pair);
      this.logger.error(
        `[Zenvia][start][failed] executionId=${executionId} erro=${this.errorToString(err)}`,
      );
      throw err;
    }

    this.logger.log(
      `[Zenvia][start][success] executionId=${executionId} status=${sessao.status} currentIndex=${sessao.currentIndex}`,
    );

    return this.getPublicSnapshot(sessao);
  }

  obterSessao(executionId: string) {
    const sessao = this.sessoes.get(executionId);
    if (!sessao) {
      throw new NotFoundException('executionId não encontrado.');
    }
    return this.getPublicSnapshot(sessao);
  }

  obterResultadoArray(executionId: string, limparAposRetorno = true) {
    const sessao = this.sessoes.get(executionId);
    if (!sessao) {
      throw new NotFoundException('executionId não encontrado.');
    }

    const resultado = this.montarResultadoNps(sessao);

    if (limparAposRetorno) {
      this.removerSessao(executionId, 'resultado');
    }

    return resultado;
  }

  async registrarResposta(
    executionId: string,
    resposta: string,
    respostaMessageId?: string | null,
  ) {
    const respostaLimpa = (resposta || '').trim();
    if (!respostaLimpa) {
      throw new BadRequestException('Campo "resposta" é obrigatório.');
    }

    const sessao = this.sessoes.get(executionId);
    if (!sessao) {
      throw new NotFoundException('executionId não encontrado.');
    }

    this.logger.log(
      `[Zenvia][answer][request] executionId=${executionId} status=${sessao.status} msgId=${respostaMessageId ?? 'null'} textLen=${respostaLimpa.length}`,
    );

    if (sessao.status !== 'active') {
      this.logger.log(
        `[Zenvia][answer][ignored] executionId=${executionId} reason=session-not-active`,
      );
      return this.getPublicSnapshot(sessao);
    }

    const estadoAntes = sessao.runtime.engine.estadosUsuarios.get(
      sessao.runtime.chatId,
    );

    if (!estadoAntes) {
      throw new BadRequestException('Sessão sem estado atual.');
    }

    const idx = sessao.runtime.promptStateToIndex.get(estadoAntes);
    if (typeof idx !== 'number') {
      this.logger.log(
        `[Zenvia][answer][ignored] executionId=${executionId} reason=estado-nao-aguarda-resposta estado=${estadoAntes}`,
      );
      return this.getPublicSnapshot(sessao);
    }

    this.logger.log(
      `[Zenvia][answer][processing] executionId=${executionId} estado=${estadoAntes} idx=${idx}`,
    );

    const dadosAntes = { ...sessao.runtime.engine.obterDados(sessao.runtime.chatId) };
    const respostaKey = sessao.runtime.responseKeyByIndex[idx];
    if (respostaKey) {
      sessao.runtime.engine.salvarDado(
        sessao.runtime.chatId,
        respostaKey,
        respostaLimpa,
      );
    }

    await sessao.runtime.engine.process(
      sessao.runtime.messageContext,
      sessao.runtime.chatId,
      respostaLimpa,
      null,
      sessao.runtime.handler,
    );

    const estadoDepois =
      sessao.runtime.engine.estadosUsuarios.get(sessao.runtime.chatId) ??
      estadoAntes;
    const respostaConsumida = estadoDepois !== estadoAntes;

    if (!respostaConsumida) {
      sessao.runtime.engine.dadosCapturados.set(sessao.runtime.chatId, dadosAntes);
      this.logger.log(
        `[Zenvia][answer][ignored] executionId=${executionId} reason=resposta-invalida estado=${estadoAntes}`,
      );
      return this.getPublicSnapshot(sessao);
    }

    if (respostaKey) {
      sessao.runtime.engine.salvarDado(
        sessao.runtime.chatId,
        respostaKey,
        respostaLimpa,
      );
    }

    const item = sessao.itens[idx];
    item.resposta = respostaLimpa;
    item.respostaMessageId = respostaMessageId || null;
    item.respondidoEm = this.nowIso();

    this.atualizarStatusSessao(sessao);
    await this.enviarResultadoNps(sessao, 'answered');
    await this.enviarCallback(sessao, 'answered');

    const fluxoCompleto =
      sessao.currentIndex >= sessao.runtime.responseRequiredIndexes.size;
    if (fluxoCompleto) {
      await this.enviarCallback(sessao, 'completed');
      this.logger.log(
        `[Zenvia][flow][completed] executionId=${executionId}`,
      );
    }

    this.logger.log(
      `[Zenvia][answer][success] executionId=${executionId} idx=${idx} itemId=${String(item.id)} resposta=${this.stringifySafe(item.resposta, 500)} nextIndex=${sessao.currentIndex} status=${sessao.status}`,
    );

    return this.getPublicSnapshot(sessao);
  }

  async processarWebhook(body: unknown, headers: Record<string, string>) {
    this.logger.log(
      `[Zenvia][webhook][request] headers=${this.stringifySafe(this.maskHeaders(headers || {}), 800)} body=${this.stringifySafe(body, 1200)}`,
    );

    const inbound = this.normalizarWebhook(body);

    if (!inbound) {
      this.logger.log('[Zenvia][webhook][ignored] reason=payload-sem-texto');
      return { ok: true, ignored: true, reason: 'payload sem mensagem de texto' };
    }

    this.logger.log(
      `[Zenvia][webhook][normalized] from=${this.maskPhone(inbound.from)} to=${this.maskPhone(inbound.to)} executionId=${inbound.executionId ?? 'null'} textLen=${inbound.text.length}`,
    );

    const executionId =
      inbound.executionId ||
      this.sessoesAtivasPorPar.get(this.normalizarPar(inbound.to, inbound.from)) ||
      null;

    if (!executionId) {
      this.logger.log(
        `[Zenvia][webhook][ignored] reason=sessao-ativa-nao-encontrada from=${this.maskPhone(inbound.from)} to=${this.maskPhone(inbound.to)}`,
      );
      return { ok: true, ignored: true, reason: 'sessão ativa não encontrada' };
    }

    const sessao = this.sessoes.get(executionId);
    if (!sessao) {
      this.logger.log(
        `[Zenvia][webhook][ignored] reason=sessao-nao-encontrada executionId=${executionId}`,
      );
      return { ok: true, ignored: true, reason: 'sessão não encontrada' };
    }

    this.validarWebhookSecretSessao(sessao, headers, body);

    const snapshot = await this.registrarResposta(executionId, inbound.text);

    this.logger.log(
      `[Zenvia][webhook][success] executionId=${executionId} status=${snapshot.status} currentIndex=${snapshot.currentIndex}`,
    );

    return { ok: true, executionId, snapshot };
  }
}
