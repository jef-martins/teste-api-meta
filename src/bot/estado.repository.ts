import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type EstadoConfigCacheItem = {
  handler: string;
  descricao: string | null;
  flowId: string | null;
  config: Prisma.JsonValue;
};

type TransicaoCacheItem = {
  entrada: string;
  estadoDestino: string;
};

type SessaoCache = {
  estado?: string;
  nome?: string | null;
};

type FluxoMemoriaResumo = {
  flowId: string | null;
  estados: number;
  transicoes: number;
};

@Injectable()
export class EstadoRepository implements OnModuleInit {
  private readonly logger = new Logger(EstadoRepository.name);

  /**
   * Cache imutável — JAMAIS zerado em erro.
   * Só é substituído em caso de sucesso no warmUpCache (Stale-While-Revalidate).
   */
  private configCache = new Map<string, EstadoConfigCacheItem>();
  private transicoesCache = new Map<string, TransicaoCacheItem[]>();
  private estadoInicialCache: string | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }

  /** Remove acentos/diacríticos e converte para minúsculas */
  private normalizar(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toUnknownRecord(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, unknown> {
    if (!this.isRecord(value)) return {};
    return value;
  }

  private toStringRecord(value: Prisma.JsonValue): Record<string, string> {
    const obj = this.toUnknownRecord(value);
    const output: Record<string, string> = {};

    for (const [key, raw] of Object.entries(obj)) {
      if (
        typeof raw === 'string' ||
        typeof raw === 'number' ||
        typeof raw === 'boolean'
      ) {
        output[key] = String(raw);
      }
    }

    return output;
  }

  private toUnknownArray(value: Prisma.JsonValue): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  async onModuleInit() {
    await this.warmUpCache();
  }

  /**
   * Carrega todas as definições ativas para a memória.
   * Cache anterior é preservado se o banco falhar (Stale-While-Revalidate).
   */
  @OnEvent('flow.updated')
  @OnEvent('db.reconnected')
  async warmUpCache() {
    this.logger.log('{"event":"cache_refresh_start","msg":"Atualizando cache de fluxos (warmUpCache)..."}');
    try {
      const [configs, transicoes, estadoInicialNode] = await Promise.all([
        this.prisma.botEstadoConfig.findMany({ where: { ativo: true } }),
        this.prisma.botEstadoTransicao.findMany({ where: { ativo: true } }),
        this.prisma.botEstadoConfig.findFirst({
          where: {
            ativo: true,
            nodeType: 'start',
            fluxo: { ativo: true },
          },
          select: { estado: true },
        }),
      ]);

      // Constrói novos maps antes de substituir — evita estado parcialmente atualizado
      const novoConfigCache = new Map<string, EstadoConfigCacheItem>();
      configs.forEach((c) =>
        novoConfigCache.set(c.estado, {
          handler: c.handler,
          descricao: c.descricao,
          flowId: c.flowId ?? null,
          config: c.config,
        }),
      );

      const novaTransicoesCache = new Map<string, TransicaoCacheItem[]>();
      transicoes.forEach((t) => {
        const lista = novaTransicoesCache.get(t.estadoOrigem) ?? [];
        lista.push({ entrada: t.entrada, estadoDestino: t.estadoDestino });
        novaTransicoesCache.set(t.estadoOrigem, lista);
      });

      // Substitui apenas em caso de sucesso completo
      this.configCache = novoConfigCache;
      this.transicoesCache = novaTransicoesCache;
      this.estadoInicialCache = estadoInicialNode?.estado || 'NOVO';

      this.logger.log(
        `{"event":"cache_refresh_ok","states":${this.configCache.size},"transitions":${this.transicoesCache.size},"msg":"Cache de fluxos atualizado com sucesso."}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"cache_refresh_failed","msg":"Erro ao carregar cache — mantendo dados anteriores","error":"${this.getErrorMessage(err)}"}`,
      );
      // NUNCA zeramos o cache em erro — dados antigos continuam servindo o fluxo
    }
  }

  listarResumoFluxosMemoria(): FluxoMemoriaResumo[] {
    const chaveFlow = (flowId: string | null) => flowId ?? '__default__';
    const agrupado = new Map<string, FluxoMemoriaResumo>();

    for (const config of this.configCache.values()) {
      const key = chaveFlow(config.flowId ?? null);
      const atual = agrupado.get(key) ?? {
        flowId: config.flowId ?? null,
        estados: 0,
        transicoes: 0,
      };
      atual.estados += 1;
      agrupado.set(key, atual);
    }

    for (const [estadoOrigem, lista] of this.transicoesCache.entries()) {
      const flowId = this.configCache.get(estadoOrigem)?.flowId ?? null;
      const key = chaveFlow(flowId);
      const atual = agrupado.get(key) ?? { flowId, estados: 0, transicoes: 0 };
      atual.transicoes += lista.length;
      agrupado.set(key, atual);
    }

    return Array.from(agrupado.values()).sort((a, b) =>
      (a.flowId ?? '').localeCompare(b.flowId ?? ''),
    );
  }

  async obterConfigEstado(estado: string): Promise<{
    handler: string;
    descricao: string | null;
    flowId?: string | null;
    config: Record<string, unknown>;
  } | null> {
    // 1. Tenta cache imutável primeiro
    const cached = this.configCache.get(estado);
    if (cached) {
      return {
        handler: cached.handler,
        descricao: cached.descricao,
        flowId: cached.flowId ?? null,
        config: this.toUnknownRecord(cached.config),
      };
    }

    // 2. Tenta banco como fallback (somente se cache vazio para esse estado)
    try {
      const row = await this.prisma.botEstadoConfig.findFirst({
        where: { estado, ativo: true },
        select: { handler: true, descricao: true, flowId: true, config: true },
      });
      if (!row) return null;
      return {
        handler: row.handler,
        descricao: row.descricao,
        flowId: row.flowId ?? null,
        config: this.toUnknownRecord(row.config),
      };
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"db_down","msg":"Erro ao consultar estado ${estado} no banco — sem fallback de cache disponível","error":"${this.getErrorMessage(err)}"}`,
      );
      return null;
    }
  }

  async buscarProximoEstado(
    estadoAtual: string,
    entrada: string,
    acceptWildcard = true,
  ): Promise<string | null> {
    try {
      const transicoes = this.transicoesCache.get(estadoAtual) || [];

      // Busca explícita por wildcard (ex: auto-transição)
      if (entrada === '*') {
        const wildcard = transicoes.find((t) => t.entrada === '*');
        if (wildcard) return wildcard.estadoDestino;

        const dbWildcard = await this.prisma.botEstadoTransicao.findFirst({
          where: { estadoOrigem: estadoAtual, entrada: '*', ativo: true },
          select: { estadoDestino: true },
        });
        return dbWildcard?.estadoDestino ?? null;
      }

      const entradaNorm = this.normalizar(entrada);

      // Match in cache (accent + case insensitive)
      const exactMatch = transicoes.find(
        (t) => t.entrada !== '*' && this.normalizar(t.entrada) === entradaNorm,
      );
      if (exactMatch) return exactMatch.estadoDestino;

      // Wildcard fallback in cache
      if (acceptWildcard) {
        const wildcardMatch = transicoes.find((t) => t.entrada === '*');
        if (wildcardMatch) return wildcardMatch.estadoDestino;
      }

      // Fallback to database if not found in cache
      const dbRows = await this.prisma.botEstadoTransicao.findMany({
        where: { estadoOrigem: estadoAtual, ativo: true },
        select: { entrada: true, estadoDestino: true },
      });

      const dbMatch = dbRows.find((r) => {
        return r.entrada !== '*' && this.normalizar(r.entrada) === entradaNorm;
      });
      if (dbMatch) return dbMatch.estadoDestino;

      if (acceptWildcard) {
        const dbWildcard = dbRows.find((r) => r.entrada === '*');
        if (dbWildcard) return dbWildcard.estadoDestino;
      }
      return null;
    } catch (err: unknown) {
      // Banco indisponível — retorna resultado somente do cache (já verificado acima),
      // portanto aqui null é correto (cache não cobriu e banco falhou)
      this.logger.warn(
        `{"event":"db_down","msg":"Erro ao buscar próximo estado de ${estadoAtual} via '${entrada}' no banco — usando apenas cache","error":"${this.getErrorMessage(err)}"}`,
      );
      return null;
    }
  }

  async obterEstadoUsuario(chatId: string): Promise<string | null> {
    try {
      // 1. Tenta Redis primeiro
      const sessaoRaw = await this.redis.get(`session:${chatId}`);
      if (sessaoRaw) {
        const sessao = JSON.parse(sessaoRaw) as unknown;
        if (this.isRecord(sessao)) {
          const estado = (sessao as SessaoCache).estado;
          if (typeof estado === 'string' && estado) {
            return estado;
          }
        }
      }

      // 2. Fallback ao banco
      const row = await this.prisma.botEstadoUsuario.findUnique({
        where: { chatId },
        select: { estadoAtual: true },
      });
      return row?.estadoAtual ?? null;
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"db_down","msg":"Erro ao obter estado do usuário ${chatId}","error":"${this.getErrorMessage(err)}"}`,
      );
      return null;
    }
  }

  async salvarEstadoUsuario(
    chatId: string,
    estado: string,
    nome?: string | null,
  ) {
    try {
      // 1. Atualizar Redis (Expira em 7 dias = 604800 segundos)
      await this.redis.set(
        `session:${chatId}`,
        JSON.stringify({ estado, nome }),
        'EX',
        604800,
      );

      // 2. Atualizar PG em background (falha silenciosa)
      this.prisma.botEstadoUsuario
        .upsert({
          where: { chatId },
          update: { estadoAtual: estado, nome: nome || undefined },
          create: { chatId, estadoAtual: estado, nome: nome || undefined },
        })
        .catch((err: any) => {
          if (err?.code === 'P2003') {
            this.logger.warn(
              `[${chatId}] Estado '${estado}' não existe mais no banco (fluxo atualizado?). Salvamento abortado, fluxo será reiniciado na próxima mensagem.`,
            );
          } else {
            this.logger.error(
              `Erro ao salvar no banco em background [${chatId}]: ${this.getErrorMessage(err)}`,
            );
          }
        });
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"db_down","msg":"Erro ao salvar estado do usuário ${chatId} no Redis/DB","error":"${this.getErrorMessage(err)}"}`,
      );
    }
  }

  async limparEstadoUsuario(chatId: string) {
    try {
      await this.redis.del(`session:${chatId}`);
      await this.prisma.botEstadoUsuario
        .delete({ where: { chatId } })
        .catch(() => {
          /* registro pode não existir */
        });
    } catch (err: unknown) {
      this.logger.error(
        `Erro ao limpar estado do usuário [${chatId}]: ${this.getErrorMessage(err)}`,
      );
    }
  }

  async registrarTransicao(
    chatId: string,
    estadoAnterior: string,
    estadoNovo: string,
    mensagemGatilho?: string | null,
  ) {
    try {
      await this.prisma.botEstadoHistorico.create({
        data: { chatId, estadoAnterior, estadoNovo, mensagemGatilho },
      });
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"db_down","msg":"Erro ao registrar transição ${estadoAnterior}->${estadoNovo} para ${chatId}","error":"${this.getErrorMessage(err)}"}`,
      );
    }
  }

  async obterRotaApi(
    apiId: string,
    routeId: string,
  ): Promise<{
    url: string;
    metodo: string;
    headers: Record<string, string>;
    parametros: unknown[];
    bodyTemplate: Prisma.JsonValue | null;
  } | null> {
    try {
      const [api, rota] = await Promise.all([
        this.prisma.apiRegistrada.findUnique({
          where: { id: apiId },
          select: { urlBase: true, headers: true },
        }),
        this.prisma.apiRota.findUnique({
          where: { id: routeId },
          select: {
            path: true,
            metodo: true,
            parametros: true,
            bodyTemplate: true,
          },
        }),
      ]);
      if (!api || !rota) return null;
      return {
        url: api.urlBase.replace(/\/$/, '') + rota.path,
        metodo: rota.metodo || 'GET',
        headers: this.toStringRecord(api.headers),
        parametros: this.toUnknownArray(rota.parametros),
        bodyTemplate: rota.bodyTemplate ?? null,
      };
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"db_down","msg":"Erro ao obter rota API ${apiId}/${routeId}","error":"${this.getErrorMessage(err)}"}`,
      );
      return null;
    }
  }

  async obterVariaveisFluxoAtivo(): Promise<Record<string, string>> {
    try {
      const fluxoAtivo = await this.prisma.botFluxo.findFirst({
        where: { ativo: true },
        select: { id: true },
      });
      if (!fluxoAtivo) return {};

      const variaveis = await this.prisma.botFluxoVariavel.findMany({
        where: { flowId: fluxoAtivo.id },
        select: { chave: true, valorPadrao: true },
      });

      const resultado: Record<string, string> = {};
      for (const v of variaveis) {
        if (v.chave && v.valorPadrao) {
          resultado[v.chave] = v.valorPadrao;
        }
      }
      return resultado;
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"db_down","msg":"Erro ao obter variáveis do fluxo ativo","error":"${this.getErrorMessage(err)}"}`,
      );
      return {};
    }
  }

  async obterEstadoInicial(): Promise<string | null> {
    try {
      if (this.estadoInicialCache) {
        return this.estadoInicialCache;
      }

    // 2. Fallback ao banco
    try {
      const row = await this.prisma.botEstadoConfig.findFirst({
        where: {
          ativo: true,
          nodeType: 'start',
          fluxo: { ativo: true },
        },
        select: { estado: true },
      });
      // Retorna null quando não há estado start ativo
      // (evita persistir 'NOVO' — que não existe no banco — quebrando a FK constraint)
      return row?.estado ?? null;
    } catch {
      return null;
    }
  }

  async obterFluxoAtivo(): Promise<string | null> {
    try {
      const fluxoAtivo = await this.prisma.botFluxo.findFirst({
        where: { ativo: true },
        select: { id: true },
      });
      return fluxoAtivo?.id ?? null;
    } catch (err: any) {
      this.logger.error(`Erro ao obter fluxo ativo: ${err.message}`);
      return null;
    }
  }
}
