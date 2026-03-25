import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class EstadoRepository implements OnModuleInit {
  private readonly logger = new Logger(EstadoRepository.name);

  // Cache de configurações de nós
  private configCache = new Map<string, any>();
  // Cache de transições indexado pelo estado de origem
  private transicoesCache = new Map<string, any[]>();
  // Cache do estado inicial
  private estadoInicialCache: string | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.warmUpCache();
  }

  /**
   * Carrega todas as definições ativas para a memória
   */
  @OnEvent('flow.updated')
  async warmUpCache() {
    this.logger.log('Atualizando cache de fluxos (warmUpCache)...');
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

      this.configCache.clear();
      configs.forEach((c) => this.configCache.set(c.estado, c));

      this.transicoesCache.clear();
      transicoes.forEach((t) => {
        const lista = this.transicoesCache.get(t.estadoOrigem) || [];
        lista.push(t);
        this.transicoesCache.set(t.estadoOrigem, lista);
      });

      this.estadoInicialCache = estadoInicialNode?.estado || 'NOVO';
      
      this.logger.log(`Cache atualizado: ${this.configCache.size} estados, ${this.transicoesCache.size} origens de transição.`);
    } catch (err: any) {
      this.logger.error(`Erro ao carregar cache de fluxos: ${err.message}`);
    }
  }

  async obterConfigEstado(estado: string) {
    try {
      const cached = this.configCache.get(estado);
      if (cached) {
        return {
          handler: cached.handler,
          descricao: cached.descricao,
          config: (cached.config as any) ?? {},
        };
      }

      // Fallback
      const row = await this.prisma.botEstadoConfig.findFirst({
        where: { estado, ativo: true },
        select: { handler: true, descricao: true, config: true },
      });
      if (!row) return null;
      return {
        handler: row.handler,
        descricao: row.descricao,
        config: (row.config as any) ?? {},
      };
    } catch (err: any) {
      this.logger.error(`Erro ao consultar estado ${estado}: ${err.message}`);
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

      // Exact match first in cache
      let exactMatch = transicoes.find((t) => t.entrada === entrada);
      if (exactMatch) return exactMatch.estadoDestino;

      // Wildcard fallback in cache
      if (acceptWildcard && entrada !== '*') {
        let wildcardMatch = transicoes.find((t) => t.entrada === '*');
        if (wildcardMatch) return wildcardMatch.estadoDestino;
      }

      // Fallback to database if not found in cache (e.g. cache hasn't loaded properly)
      let row = await this.prisma.botEstadoTransicao.findFirst({
        where: {
          estadoOrigem: estadoAtual,
          entrada: { equals: entrada, mode: 'insensitive' },
          ativo: true,
        },
        select: { estadoDestino: true },
      });
      if (row) return row.estadoDestino;

      if (acceptWildcard && entrada !== '*') {
        row = await this.prisma.botEstadoTransicao.findFirst({
          where: { estadoOrigem: estadoAtual, entrada: '*', ativo: true },
          select: { estadoDestino: true },
        });
        if (row) return row.estadoDestino;
      }
      return null;
    } catch (err: any) {
      this.logger.error(
        `Erro ao buscar próximo estado de ${estadoAtual} via ${entrada}: ${err.message}`,
      );
      return null;
    }
  }

  async obterEstadoUsuario(chatId: string): Promise<string | null> {
    try {
      // 1. Try Redis first
      const sessaoRaw = await this.redis.get(`session:${chatId}`);
      if (sessaoRaw) {
        const sessao = JSON.parse(sessaoRaw);
        if (sessao && sessao.estado) {
          return sessao.estado;
        }
      }

      // 2. Fallback to DB
      const row = await this.prisma.botEstadoUsuario.findUnique({
        where: { chatId },
        select: { estadoAtual: true },
      });
      return row?.estadoAtual ?? null;
    } catch (err: any) {
      this.logger.error(`Erro ao obter estado do usuário: ${err.message}`);
      return null;
    }
  }

  async salvarEstadoUsuario(
    chatId: string,
    estado: string,
    nome?: string | null,
  ) {
    try {
      // 1. Atualizar Redis (Expira em 7 dias se o usuário sumir = 604800 segundos)
      await this.redis.set(
        `session:${chatId}`,
        JSON.stringify({ estado, nome }),
        'EX',
        604800,
      );

      // 2. Atualizar PG em background
      this.prisma.botEstadoUsuario
        .upsert({
          where: { chatId },
          update: { estadoAtual: estado, nome: nome || undefined },
          create: { chatId, estadoAtual: estado, nome: nome || undefined },
        })
        .catch((err) =>
          this.logger.error(`Erro ao salvar no banco em background: ${err}`),
        );
    } catch (err: any) {
      this.logger.error(`Erro ao salvar estado do usuário no Redis/DB: ${err.message}`);
    }
  }

  async registrarTransicao(
    chatId: string,
    estadoAnterior: string,
    estadoNovo: string,
    mensagemGatilho?: string | null,
  ) {
    try {
      // Registrar no banco (historico pode ser importante, não vale a pena por no redis apenas)
      await this.prisma.botEstadoHistorico.create({
        data: { chatId, estadoAnterior, estadoNovo, mensagemGatilho },
      });
    } catch (err: any) {
      this.logger.error(`Erro ao registrar transição: ${err.message}`);
    }
  }

  async obterRotaApi(apiId: string, routeId: string) {
    try {
      const [api, rota] = await Promise.all([
        this.prisma.apiRegistrada.findUnique({
          where: { id: apiId },
          select: { urlBase: true, headers: true },
        }),
        this.prisma.apiRota.findUnique({
          where: { id: routeId },
          select: { path: true, metodo: true, parametros: true, bodyTemplate: true },
        }),
      ]);
      if (!api || !rota) return null;
      return {
        url: api.urlBase.replace(/\/$/, '') + rota.path,
        metodo: rota.metodo || 'GET',
        headers: (api.headers as Record<string, string>) || {},
        parametros: (rota.parametros as any[]) || [],
        bodyTemplate: rota.bodyTemplate ?? null,
      };
    } catch (err: any) {
      this.logger.error(`Erro ao obter rota API: ${err.message}`);
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
    } catch (err: any) {
      this.logger.error(
        `Erro ao obter variáveis do fluxo ativo: ${err.message}`,
      );
      return {};
    }
  }

  async obterEstadoInicial(): Promise<string> {
    try {
      if (this.estadoInicialCache) {
        return this.estadoInicialCache;
      }

      // Fallback
      const row = await this.prisma.botEstadoConfig.findFirst({
        where: {
          ativo: true,
          nodeType: 'start',
          fluxo: { ativo: true },
        },
        select: { estado: true },
      });
      return row?.estado || 'NOVO';
    } catch {
      return 'NOVO';
    }
  }
}
