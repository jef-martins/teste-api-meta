import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type KeywordCache = {
  id: string;
  keyword: string;
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

  /**
   * Recarrega o cache a partir do banco.
   * Chamado na inicialização e após reconexão.
   */
  async recarregarCache(): Promise<void> {
    if (!this.prisma.isConnected) return;
    try {
      const registros = await this.prisma.botKeywordGlobal.findMany({
        orderBy: [{ keyword: 'asc' }],
      });
      this.cache = registros;
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
        orderBy: [{ keyword: 'asc' }],
      });
      this.cache = resultado;
      this.cacheCarregado = true;
      return resultado;
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
      return await this.prisma.botKeywordGlobal.findUnique({ where: { id } });
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
      return await this.prisma.botKeywordGlobal.findUnique({
        where: { keyword },
      });
    } catch (err: unknown) {
      this.logger.warn(
        `{"event":"db_down","msg":"Erro ao buscarPorKeyword '${keyword}' — usando cache","error":"${this.getErrorMessage(err)}"}`,
      );
      return this.cache.find((k) => k.keyword === keyword) ?? null;
    }
  }

  async buscarKeywordAtiva(keyword: string): Promise<KeywordCache | null> {
    // 1. Tenta banco
    if (this.prisma.isConnected) {
      try {
        const resultado = await this.prisma.botKeywordGlobal.findFirst({
          where: { keyword, ativo: true },
        });
        return resultado;
      } catch (err: unknown) {
        this.logger.warn(
          `{"event":"db_down","msg":"Erro ao buscarKeywordAtiva '${keyword}' — usando cache","error":"${this.getErrorMessage(err)}"}`,
        );
      }
    }

    // 2. Fallback ao cache
    return this.cache.find((k) => k.keyword === keyword && k.ativo) ?? null;
  }

  async criar(data: {
    keyword: string;
    estadoDestino: string;
    ativo: boolean;
  }): Promise<KeywordCache> {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    const criado = await this.prisma.botKeywordGlobal.create({ data });
    // Atualiza cache local
    this.cache.push(criado);
    return criado;
  }

  async atualizar(
    id: string,
    data: { keyword: string; estadoDestino: string; ativo: boolean },
  ): Promise<KeywordCache> {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    const atualizado = await this.prisma.botKeywordGlobal.update({
      where: { id },
      data,
    });
    // Atualiza cache local
    const idx = this.cache.findIndex((k) => k.id === id);
    if (idx !== -1) this.cache[idx] = atualizado;
    else this.cache.push(atualizado);
    return atualizado;
  }

  async atualizarAtivo(id: string, ativo: boolean): Promise<KeywordCache> {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    const atualizado = await this.prisma.botKeywordGlobal.update({
      where: { id },
      data: { ativo },
    });
    // Atualiza cache local
    const idx = this.cache.findIndex((k) => k.id === id);
    if (idx !== -1) this.cache[idx] = atualizado;
    return atualizado;
  }

  async excluir(id: string): Promise<KeywordCache> {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    const excluido = await this.prisma.botKeywordGlobal.delete({
      where: { id },
    });
    // Remove do cache local
    this.cache = this.cache.filter((k) => k.id !== id);
    return excluido;
  }

  /** Retorna o cache atual (para testes ou diagnóstico). */
  getCacheSnapshot(): KeywordCache[] {
    return [...this.cache];
  }

  isCacheCarregado(): boolean {
    return this.cacheCarregado;
  }
}
