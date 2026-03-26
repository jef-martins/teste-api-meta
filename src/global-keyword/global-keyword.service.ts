import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ESTADOS } from '../bot/meta/default-state-machine.config';
import { GlobalKeywordRepository } from './global-keyword.repository';

type KeywordMemoria = {
  id: string;
  keyword: string;
  estadoDestino: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
};

export class GlobalKeywordDto {
  keyword!: string;
  estado_destino!: string;
  ativo?: boolean;
}

@Injectable()
export class GlobalKeywordService {
  private readonly keywordsMemoria: KeywordMemoria[] = [];

  constructor(
    private prisma: PrismaService,
    private repository: GlobalKeywordRepository,
  ) { }

  private isDefaultMode() {
    return process.env.BOT_STATE_MACHINE_PADRAO === 'true';
  }

  private normalizarKeyword(keyword: string | undefined) {
    return typeof keyword === 'string' ? keyword.trim() : '';
  }

  private normalizarEstado(estado: string | undefined) {
    return typeof estado === 'string' ? estado.trim().toUpperCase() : '';
  }

  private serializar(registro: {
    id: string;
    keyword: string;
    estadoDestino: string;
    ativo: boolean;
    criadoEm: Date;
    atualizadoEm: Date;
  }) {
    return {
      id: registro.id,
      keyword: registro.keyword,
      estado_destino: registro.estadoDestino,
      ativo: registro.ativo,
      created_at: registro.criadoEm,
      updated_at: registro.atualizadoEm,
    };
  }

  private async validarEstadoDestino(estadoDestino: string) {
    if (!estadoDestino) {
      throw new BadRequestException('Estado de destino é obrigatório.');
    }

    if (this.isDefaultMode() || !this.prisma.isConnected) {
      const estado = DEFAULT_ESTADOS[estadoDestino];
      if (!estado || estado.ativo === false) {
        throw new BadRequestException('Estado de destino inválido ou inativo.');
      }
      return;
    }

    const existe = await this.prisma.botEstadoConfig.findFirst({
      where: { estado: estadoDestino, ativo: true },
      select: { estado: true },
    });
    if (!existe) {
      throw new BadRequestException('Estado de destino inválido ou inativo.');
    }
  }

  private validarPayload(data: GlobalKeywordDto) {
    const keyword = this.normalizarKeyword(data.keyword);
    const estadoDestino = this.normalizarEstado(data.estado_destino);
    const ativo = data.ativo !== false;

    if (!keyword) {
      throw new BadRequestException('Keyword é obrigatória.');
    }

    return { keyword, estadoDestino, ativo };
  }

  private buscarMemoriaPorId(id: string) {
    return this.keywordsMemoria.find((item) => item.id === id) ?? null;
  }

  private buscarMemoriaPorKeyword(keyword: string) {
    return (
      this.keywordsMemoria.find((item) => item.keyword === keyword) ?? null
    );
  }

  async listar() {
    if (this.isDefaultMode()) {
      return [...this.keywordsMemoria]
        .sort((a, b) => a.keyword.localeCompare(b.keyword))
        .map((item) => this.serializar(item));
    }

    const registros = await this.repository.listar();
    return registros.map((item) => this.serializar(item));
  }

  async criar(data: GlobalKeywordDto) {
    const { keyword, estadoDestino, ativo } = this.validarPayload(data);
    await this.validarEstadoDestino(estadoDestino);

    if (this.isDefaultMode()) {
      if (this.buscarMemoriaPorKeyword(keyword)) {
        throw new ConflictException('Já existe uma keyword com esse valor.');
      }

      const agora = new Date();
      const registro: KeywordMemoria = {
        id: randomUUID(),
        keyword,
        estadoDestino,
        ativo,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      this.keywordsMemoria.push(registro);
      return this.serializar(registro);
    }

    const existente = await this.repository.buscarPorKeyword(keyword);
    if (existente) {
      throw new ConflictException('Já existe uma keyword com esse valor.');
    }

    const criado = await this.repository.criar({
      keyword,
      estadoDestino,
      ativo,
    });
    return this.serializar(criado);
  }

  async atualizar(id: string, data: GlobalKeywordDto) {
    const { keyword, estadoDestino, ativo } = this.validarPayload(data);
    await this.validarEstadoDestino(estadoDestino);

    if (this.isDefaultMode()) {
      const atual = this.buscarMemoriaPorId(id);
      if (!atual) {
        throw new NotFoundException('Keyword global não encontrada.');
      }

      const duplicada = this.buscarMemoriaPorKeyword(keyword);
      if (duplicada && duplicada.id !== id) {
        throw new ConflictException('Já existe uma keyword com esse valor.');
      }

      atual.keyword = keyword;
      atual.estadoDestino = estadoDestino;
      atual.ativo = ativo;
      atual.atualizadoEm = new Date();
      return this.serializar(atual);
    }

    const atual = await this.repository.buscarPorId(id);
    if (!atual) {
      throw new NotFoundException('Keyword global não encontrada.');
    }

    const duplicada = await this.repository.buscarPorKeyword(keyword);
    if (duplicada && duplicada.id !== id) {
      throw new ConflictException('Já existe uma keyword com esse valor.');
    }

    const atualizado = await this.repository.atualizar(id, {
      keyword,
      estadoDestino,
      ativo,
    });
    return this.serializar(atualizado);
  }

  async atualizarAtivo(id: string, ativo: boolean) {
    if (this.isDefaultMode()) {
      const atual = this.buscarMemoriaPorId(id);
      if (!atual) {
        throw new NotFoundException('Keyword global não encontrada.');
      }
      atual.ativo = ativo;
      atual.atualizadoEm = new Date();
      return this.serializar(atual);
    }

    const atual = await this.repository.buscarPorId(id);
    if (!atual) {
      throw new NotFoundException('Keyword global não encontrada.');
    }

    const atualizado = await this.repository.atualizarAtivo(id, ativo);
    return this.serializar(atualizado);
  }

  async excluir(id: string) {
    if (this.isDefaultMode()) {
      const index = this.keywordsMemoria.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new NotFoundException('Keyword global não encontrada.');
      }
      this.keywordsMemoria.splice(index, 1);
      return { ok: true };
    }

    const atual = await this.repository.buscarPorId(id);
    if (!atual) {
      throw new NotFoundException('Keyword global não encontrada.');
    }

    await this.repository.excluir(id);
    return { ok: true };
  }

  async buscarKeywordAtiva(keywordInformada: string) {
    const keyword = this.normalizarKeyword(keywordInformada);
    if (!keyword) return null;

    if (this.isDefaultMode()) {
      const item = this.keywordsMemoria.find(
        (registro) => registro.ativo && registro.keyword === keyword,
      );
      return item
        ? {
            id: item.id,
            keyword: item.keyword,
            estadoDestino: item.estadoDestino,
          }
        : null;
    }

    const item = await this.repository.buscarKeywordAtiva(keyword);
    return item
      ? {
          id: item.id,
          keyword: item.keyword,
          estadoDestino: item.estadoDestino,
        }
      : null;
  }
}
