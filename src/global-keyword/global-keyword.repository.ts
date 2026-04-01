import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type KeywordCache = {
  id: string;
  keyword: string;
  flowId: string | null;
  flowNome: string | null;
  estadoDestino: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
};

@Injectable()
export class GlobalKeywordRepository {
  private readonly logger = new Logger(GlobalKeywordRepository.name);

  /**
   * Cache em memória de keywords (Stale-While-Revalidate).
   * NUNCA é zerado em caso de erro de banco.
   */
  private cache: KeywordCache[] = [];
  private cacheCarregado = false;

  constructor(private prisma: PrismaService) {}

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }

  private normalizarFlowId(flowId: string | null | undefined): string | null {
    if (typeof flowId !== 'string') return null;
    return flowId.trim();
  }

  private toCacheRecord(registro: {
    id: string;
    keyword: string;
    flowId: string | null;
    estadoDestino: string;
    ativo: boolean;
    criadoEm: Date;
    atualizadoEm: Date;
    fluxo?: { nome: string } | null;
  }): KeywordCache {
    return {
      id: registro.id,
      keyword: registro.keyword,
      flowId: registro.flowId ?? null,
      flowNome: registro.fluxo?.nome ?? null,
      estadoDestino: registro.estadoDestino,
      ativo: registro.ativo,
      criadoEm: registro.criadoEm,
      atualizadoEm: registro.atualizadoEm,
    };
  }

  /**
   * Recarrega o cache a partir do banco.
   * Chamado na inicialização e após reconexão.
   */
  async recarregarCache(): Promise<void> {
    if (!this.prisma.isConnected) return;
    try {
      const registros = await this.prisma.botKeywordGlobal.findMany({
        select: {
          id: true,
          keyword: true,
          flowId: true,
          estadoDestino: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
          fluxo: { select: { nome: true } },
        },
        orderBy: [{ keyword: 'asc' }],
      });
      this.cache = registros.map((registro) => this.toCacheRecord(registro));
      this.cacheCarregado = true;
      this.logger.log(
        `{"event":"cache_refresh_ok","msg":"Cache de keywords recarregado","count":${this.cache.length}}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `{"event":"cache_refresh_failed","msg":"Erro ao recarregar cache de keywords — mantendo dados anteriores","error":"${this.getErrorMessage(err)}"}`,
      );
    }
  }

  async listar(): Promise<KeywordCache[]> {
    if (!this.prisma.isConnected) {
      this.logger.warn('{"event":"db_down","msg":"listar keywords via cache (banco indisponível)"}');
      return [...this.cache];
    }
    try {
      const resultado = await this.prisma.botKeywordGlobal.findMany({
        select: {
          id: true,
          keyword: true,
          flowId: true,
          estadoDestino: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
          fluxo: { select: { nome: true } },
        },
        orderBy: [{ keyword: 'asc' }],
      });
      this.cache = resultado.map((registro) => this.toCacheRecord(registro));
      this.cacheCarregado = true;
      return [...this.cache];
    } catch (err: unknown) {
      this.logger.warn(
        `{"event":"db_down","msg":"Erro ao listar keywords — usando cache","error":"${this.getErrorMessage(err)}"}`,
      );
      return [...this.cache];
    }
  }

  async buscarPorId(id: string): Promise<KeywordCache | null> {
    if (!this.prisma.isConnected) {
      return this.cache.find((k) => k.id === id) ?? null;
    }
    try {
      const encontrado = await this.prisma.botKeywordGlobal.findUnique({
        where: { id },
        select: {
          id: true,
          keyword: true,
          flowId: true,
          estadoDestino: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
          fluxo: { select: { nome: true } },
        },
      });
      return encontrado ? this.toCacheRecord(encontrado) : null;
    } catch (err: unknown) {
      this.logger.warn(
        `{"event":"db_down","msg":"Erro ao buscarPorId keyword ${id} — usando cache","error":"${this.getErrorMessage(err)}"}`,
      );
      return this.cache.find((k) => k.id === id) ?? null;
    }
  }

  async buscarPorKeyword(keyword: string): Promise<KeywordCache | null> {
    if (!this.prisma.isConnected) {
      return this.cache.find((k) => k.keyword === keyword) ?? null;
    }
    try {
      const encontrado = await this.prisma.botKeywordGlobal.findUnique({
        where: { keyword },
        select: {
          id: true,
          keyword: true,
          flowId: true,
          estadoDestino: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
          fluxo: { select: { nome: true } },
        },
      });
      return encontrado ? this.toCacheRecord(encontrado) : null;
    } catch (err: unknown) {
      this.logger.warn(
        `{"event":"db_down","msg":"Erro ao buscarPorKeyword '${keyword}' — usando cache","error":"${this.getErrorMessage(err)}"}`,
      );
      return this.cache.find((k) => k.keyword === keyword) ?? null;
    }
  }

  async buscarKeywordAtiva(
    keyword: string,
    flowIdContexto: string | null,
  ): Promise<KeywordCache | null> {
    const flowId = this.normalizarFlowId(flowIdContexto);
    if (flowId === null) return null;

    // 1. Tenta banco
    if (this.prisma.isConnected) {
      try {
        const resultado = await this.prisma.botKeywordGlobal.findFirst({
          where: { keyword, ativo: true, flowId },
          select: {
            id: true,
            keyword: true,
            flowId: true,
            estadoDestino: true,
            ativo: true,
            criadoEm: true,
            atualizadoEm: true,
            fluxo: { select: { nome: true } },
          },
        });
        return resultado ? this.toCacheRecord(resultado) : null;
      } catch (err: unknown) {
        this.logger.warn(
          `{"event":"db_down","msg":"Erro ao buscarKeywordAtiva '${keyword}' — usando cache","error":"${this.getErrorMessage(err)}"}`,
        );
      }
    }

    // 2. Fallback ao cache
    return (
      this.cache.find(
        (k) =>
          k.keyword === keyword &&
          k.ativo &&
          this.normalizarFlowId(k.flowId) === flowId,
      ) ?? null
    );
  }

  async criar(data: {
    keyword: string;
    flowId: string;
    estadoDestino: string;
    ativo: boolean;
  }): Promise<KeywordCache> {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    const criado = await this.prisma.botKeywordGlobal.create({
      data,
      select: {
        id: true,
        keyword: true,
        flowId: true,
        estadoDestino: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        fluxo: { select: { nome: true } },
      },
    });
    const criadoCache = this.toCacheRecord(criado);
    // Atualiza cache local
    this.cache.push(criadoCache);
    return criadoCache;
  }

  async atualizar(
    id: string,
    data: {
      keyword: string;
      flowId: string;
      estadoDestino: string;
      ativo: boolean;
    },
  ): Promise<KeywordCache> {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    const atualizado = await this.prisma.botKeywordGlobal.update({
      where: { id },
      data,
      select: {
        id: true,
        keyword: true,
        flowId: true,
        estadoDestino: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        fluxo: { select: { nome: true } },
      },
    });
    const atualizadoCache = this.toCacheRecord(atualizado);
    // Atualiza cache local
    const idx = this.cache.findIndex((k) => k.id === id);
    if (idx !== -1) this.cache[idx] = atualizadoCache;
    else this.cache.push(atualizadoCache);
    return atualizadoCache;
  }

  async atualizarAtivo(id: string, ativo: boolean): Promise<KeywordCache> {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    const atualizado = await this.prisma.botKeywordGlobal.update({
      where: { id },
      data: { ativo },
      select: {
        id: true,
        keyword: true,
        flowId: true,
        estadoDestino: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        fluxo: { select: { nome: true } },
      },
    });
    const atualizadoCache = this.toCacheRecord(atualizado);
    // Atualiza cache local
    const idx = this.cache.findIndex((k) => k.id === id);
    if (idx !== -1) this.cache[idx] = atualizadoCache;
    else this.cache.push(atualizadoCache);
    return atualizadoCache;
  }

  async excluir(id: string): Promise<KeywordCache> {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    const excluido = await this.prisma.botKeywordGlobal.delete({
      where: { id },
      select: {
        id: true,
        keyword: true,
        flowId: true,
        estadoDestino: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        fluxo: { select: { nome: true } },
      },
    });
    const excluidoCache = this.toCacheRecord(excluido);
    // Remove do cache local
    this.cache = this.cache.filter((k) => k.id !== id);
    return excluidoCache;
  }

  /** Retorna o cache atual (para testes ou diagnóstico). */
  getCacheSnapshot(): KeywordCache[] {
    return [...this.cache];
  }

  isCacheCarregado(): boolean {
    return this.cacheCarregado;
  }
}
