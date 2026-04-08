import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  DEFAULT_ESTADOS,
  DEFAULT_TRANSICOES,
} from './default-state-machine.config';

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
  flowId?: string | null;
  ultimaAtividadeEm?: string;
  meta?: {
    tempoExpiracaoMs?: number | null;
  };
};

type FluxoMemoriaResumo = {
  flowId: string | null;
  estados: number;
  transicoes: number;
};

type SyncTask = {
  type: 'state_update' | 'transition';
  data: any;
};

@Injectable()
export class EstadoRepository implements OnModuleInit {
  private readonly logger = new Logger(EstadoRepository.name);

  private configCache = new Map<string, EstadoConfigCacheItem>();
  private transicoesCache = new Map<string, TransicaoCacheItem[]>();
  private variaveisGlobaisCache: Record<string, string> = {};
  private estadoInicialCache: string | null = null;

  constructor(
    private prisma: PrismaService,
    public redis: RedisService,
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

  @OnEvent('flow.updated')
  @OnEvent('db.reconnected')
  async warmUpCache() {
    this.logger.log('{"event":"cache_refresh_start","msg":"Atualizando cache de fluxos (warmUpCache)..."}');
    try {

      const novoConfigCache = new Map<string, EstadoConfigCacheItem>();
      const novaTransicoesCache = new Map<string, TransicaoCacheItem[]>();

      // Constantes de chaves no Redis para o fluxo global
      const REDIS_KEY_CONFIG = 'bot:config:states';
      const REDIS_KEY_TRANS = 'bot:config:transitions';
      const REDIS_KEY_START = 'bot:config:start_state';

      // 1. Tenta carregar do PostgreSQL (Prioridade - Sincroniza Redis)
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

        if (configs.length > 0) {
          configs.forEach((c) =>
            novoConfigCache.set(c.estado, {
              handler: c.handler,
              descricao: c.descricao,
              flowId: c.flowId ?? null,
              config: c.config,
            }),
          );

          transicoes.forEach((t) => {
            const lista = novaTransicoesCache.get(t.estadoOrigem) ?? [];
            lista.push({ entrada: t.entrada, estadoDestino: t.estadoDestino });
            novaTransicoesCache.set(t.estadoOrigem, lista);
          });

          this.estadoInicialCache = estadoInicialNode?.estado || 'INICIO';

          // SALVA NO REDIS PARA RESILIÊNCIA
          await Promise.all([
            this.redis.set(REDIS_KEY_CONFIG, JSON.stringify(Array.from(novoConfigCache.entries()))),
            this.redis.set(REDIS_KEY_TRANS, JSON.stringify(Array.from(novaTransicoesCache.entries()))),
            this.redis.set(REDIS_KEY_START, this.estadoInicialCache),
          ]);

          this.logger.log(`[Cache] DB -> Redis: Sincronizado (${configs.length} estados).`);
          
          // Sincroniza também as variáveis globais
          await this.syncVariaveisGlobais();
        }
      } catch (dbErr: unknown) {
        this.logger.warn(`[Cache] DB Offline. Buscando resiliência no Redis...`);
        
        // 2. Tenta carregar do Redis (Segundo nível de resiliência)
        try {
          const [resStates, resTrans, resStart] = await Promise.all([
            this.redis.get(REDIS_KEY_CONFIG),
            this.redis.get(REDIS_KEY_TRANS),
            this.redis.get(REDIS_KEY_START),
          ]);

          if (resStates && resTrans) {
            const parsedStates = JSON.parse(resStates) as Array<[string, EstadoConfigCacheItem]>;
            const parsedTrans = JSON.parse(resTrans) as Array<[string, TransicaoCacheItem[]]>;
            
            parsedStates.forEach(([k, v]) => novoConfigCache.set(k, v));
            parsedTrans.forEach(([k, v]) => novaTransicoesCache.set(k, v));
            this.estadoInicialCache = resStart || 'INICIO';

            this.logger.log(`[Cache] Redis -> Memória: Restaurado com sucesso.`);
          }
        } catch (redisErr: unknown) {
          this.logger.error(`[Cache] Redis falhou também ao carregar baseline.`);
        }
      }

      // 3. Fallback Final: Bot Padrão (Apenas se o cache de memória estiver vazio após DB e Redis)
      if (novoConfigCache.size === 0) {
        this.logger.warn(`[Cache] Redis e DB vazios/offline. Acionando Motor de Reserva (Default Bot).`);
        Object.entries(DEFAULT_ESTADOS).forEach(([estado, c]) => {
          novoConfigCache.set(estado, {
            handler: c.handler,
            descricao: c.descricao,
            flowId: null,
            config: c.config as Prisma.JsonValue,
          });
        });

        Object.entries(DEFAULT_TRANSICOES).forEach(([estadoOrigem, lista]) => {
          novaTransicoesCache.set(
            estadoOrigem,
            lista.map((t) => ({
              entrada: t.entrada,
              estadoDestino: t.estadoDestino,
            })),
          );
        });
        this.estadoInicialCache = 'INICIO';
      }

      this.configCache = novoConfigCache;
      this.transicoesCache = novaTransicoesCache;
      if (!this.estadoInicialCache) this.estadoInicialCache = 'INICIO';

      this.logger.log(
        `{"event":"cache_refresh_ok","states":${this.configCache.size},"transitions":${this.transicoesCache.size},"msg":"Cache de fluxos sincronizado."}`,
      );
      
      // Sincroniza qualquer atualização pendente feita offline
      await this.processarFilaSincronia();
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"cache_refresh_failed","msg":"Erro ao carregar cache — mantendo dados anteriores","error":"${this.getErrorMessage(err)}"}`,
      );
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

  async obterConfigEstado(
    estado: string,
    chatId?: string,
  ): Promise<{
    handler: string;
    descricao: string | null;
    flowId?: string | null;
    config: Record<string, unknown>;
  } | null> {
    if (chatId) {
      try {
        const sessaoRaw = await this.redis.get(`session:${chatId}`);
        if (sessaoRaw) {
          const sessao = JSON.parse(sessaoRaw) as any;
          if (sessao.dynamic_states && sessao.dynamic_states[estado]) {
            const ds = sessao.dynamic_states[estado];
            return {
              handler: ds.handler,
              descricao: ds.descricao || null,
              flowId: 'DYNAMIC',
              config: ds.config || {},
            };
          }
        }
      } catch {}
    }

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
    chatId?: string,
  ): Promise<string | null> {
    if (chatId) {
      try {
        const sessaoRaw = await this.redis.get(`session:${chatId}`);
        if (sessaoRaw) {
          const sessao = JSON.parse(sessaoRaw) as any;
          if (sessao.dynamic_transitions && sessao.dynamic_transitions[estadoAtual]) {
            const transicoes = sessao.dynamic_transitions[estadoAtual] as TransicaoCacheItem[];
            this.logger.debug(`[${chatId}] Transições dinâmicas encontradas para ${estadoAtual}: ${JSON.stringify(transicoes)}`);
            
            // Exact match
            const exact = transicoes.find(t => t.entrada === entrada);
            if (exact) {
              this.logger.debug(`[${chatId}] Match exato dinâmico: ${estadoAtual} + ${entrada} -> ${exact.estadoDestino}`);
              return exact.estadoDestino;
            }

            // Wildcard
            if (acceptWildcard && entrada !== '*') {
              const wildcard = transicoes.find(t => t.entrada === '*');
              if (wildcard) {
                this.logger.debug(`[${chatId}] Match wildcard dinâmico: ${estadoAtual} + * -> ${wildcard.estadoDestino}`);
                return wildcard.estadoDestino;
              }
            }
          } else {
            this.logger.debug(`[${chatId}] Nenhuma transição dinâmica encontrada no Redis para o estado ${estadoAtual}`);
          }
        } else {
          this.logger.debug(`[${chatId}] Sessão não encontrada no Redis para busca de transição`);
        }
      } catch (err) {
        this.logger.error(`[${chatId}] Erro ao buscar transição dinâmica no Redis: ${err.message}`);
      }
    }

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
      // 1. Atualizar Redis preservando dados dinâmicos (merge-aware)
      const rawOld = await this.redis.get(`session:${chatId}`);
      let sessao: SessaoCache = {};
      if (rawOld) {
        try { sessao = JSON.parse(rawOld); } catch {}
      }
      sessao.estado = estado;
      if (nome) sessao.nome = nome;

      // Tenta descobrir o flowId se ainda não estiver na sessão
      if (!sessao.flowId) {
        const config = await this.obterConfigEstado(estado, chatId);
        if (config && config.flowId) {
          sessao.flowId = config.flowId;
        }
      }
      
      await this.redis.set(
        `session:${chatId}`,
        JSON.stringify(sessao),
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
              `[${chatId}] Estado '${estado}' não existe mais no banco (fluxo atualizado?). Salvamento abortado (não enfileirado).`,
            );
          } else {
            this.logger.warn(`[Resiliência] Falha no banco para ${chatId}. Enfileirando estado "${estado}" para sincronia.`);
            this.enfileirarSincronia({
              type: 'state_update',
              data: { chatId, estado, nome: nome || undefined },
            });
            this.logger.error(
              `{"event":"db_down","msg":"Erro ao salvar estado de ${chatId} no banco em background","error":"${this.getErrorMessage(err)}"}`,
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
      this.logger.warn(`[Resiliência] Falha ao registrar transição para ${chatId}. Enfileirando histórico.`);
      this.enfileirarSincronia({
        type: 'transition',
        data: { chatId, estadoAnterior, estadoNovo, mensagemGatilho },
      });
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
     return this.variaveisGlobaisCache || {};
  }

  private async syncVariaveisGlobais(): Promise<void> {
    try {
      const fluxoAtivo = await this.prisma.botFluxo.findFirst({
        where: { ativo: true },
        select: { id: true },
      });
      if (!fluxoAtivo) return;

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
      this.variaveisGlobaisCache = resultado;
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"db_down","msg":"Erro ao sincronizar variáveis para o cache","error":"${this.getErrorMessage(err)}"}`,
      );
    }
  }

  async obterEstadoInicial(): Promise<string | null> {
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

  // ─── LÓGICA DE SINCRONIZAÇÃO ATRASADA (Write-Behind) ──────────────────────────

  private async enfileirarSincronia(task: SyncTask) {
    try {
      await this.redis.lpush('bot:sync:queue', JSON.stringify(task));
    } catch (err: unknown) {
      this.logger.error(`Erro crítico ao enfileirar tarefa no Redis: ${this.getErrorMessage(err)}`);
    }
  }

  /**
   * Processa a fila de sincronização pendente do Redis para o PostgreSQL.
   */
  @OnEvent('db.reconnected')
  async processarFilaSincronia() {
    this.logger.log(`[Resiliência] Iniciando sincronização de dados acumulados offline...`);
    let processados = 0;
    try {
      while (true) {
        const item = await this.redis.rpop('bot:sync:queue');
        if (!item) break;

        const task = JSON.parse(item) as SyncTask;
        try {
          if (task.type === 'state_update') {
            await this.prisma.botEstadoUsuario.upsert({
              where: { chatId: task.data.chatId },
              update: { estadoAtual: task.data.estado, nome: task.data.nome },
              create: { chatId: task.data.chatId, estadoAtual: task.data.estado, nome: task.data.nome },
            });
          } else if (task.type === 'transition') {
            await this.prisma.botEstadoHistorico.create({ data: task.data });
          }
          processados++;
        } catch (err: unknown) {
          // Se falhar o banco de novo, devolve pra fila no fim para tentar depois
          await this.redis.lpush('bot:sync:queue', item);
          this.logger.warn(`[Resiliência] Falha na sincronia, banco ainda indisponível? Abortando lote atual.`);
          break;
        }
      }
      if (processados > 0) {
        this.logger.log(`[Resiliência] Sincronização concluída: ${processados} tarefas persistidas no PG.`);
      }
    } catch (err: unknown) {
      this.logger.error(`Erro ao processar fila de sincronia: ${this.getErrorMessage(err)}`);
    }
  }
}
