import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_ESTADOS,
  DEFAULT_TRANSICOES,
} from '../bot/meta/default-state-machine.config';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {
    this.initMemoryTransitions();
  }

  private isDefaultMode() {
    return process.env.BOT_STATE_MACHINE_PADRAO === 'true';
  }

  private initMemoryTransitions() {
    if (this.isDefaultMode()) {
      let idCounter = 1;
      for (const transicoes of Object.values(DEFAULT_TRANSICOES)) {
        for (const t of transicoes) {
          if (!t.id) {
            t.id = String(idCounter++);
          }
          if (t.ativo === undefined) {
            t.ativo = true;
          }
        }
      }
      for (const estado of Object.values(DEFAULT_ESTADOS)) {
        if (estado.ativo === undefined) {
          estado.ativo = true;
        }
      }
    }
  }

  // ─── Estados ─────────────────────────────────────────────────────────────

  async listarEstados() {
    if (this.isDefaultMode()) {
      return Object.entries(DEFAULT_ESTADOS)
        .map(([estado, data]) => ({
          estado,
          handler: data.handler,
          descricao: data.descricao,
          ativo: data.ativo !== false,
          config: data.config,
        }))
        .sort((a, b) => a.estado.localeCompare(b.estado));
    }

    return this.prisma.botEstadoConfig.findMany({
      select: {
        estado: true,
        handler: true,
        descricao: true,
        ativo: true,
        config: true,
      },
      orderBy: { estado: 'asc' },
    });
  }

  async criarEstado(data: {
    estado: string;
    handler: string;
    descricao?: string;
    config?: any;
  }) {
    if (this.isDefaultMode()) {
      DEFAULT_ESTADOS[data.estado] = {
        handler: data.handler,
        descricao: data.descricao || '',
        config: data.config || {},
        ativo: true,
      };
      return { estado: data.estado };
    }

    return this.prisma.botEstadoConfig.create({
      data: {
        estado: data.estado,
        handler: data.handler,
        descricao: data.descricao || '',
        config: data.config || {},
      },
    });
  }

  async atualizarEstado(
    estado: string,
    data: {
      handler: string;
      descricao?: string;
      config?: any;
      ativo?: boolean;
    },
  ) {
    if (this.isDefaultMode()) {
      if (!DEFAULT_ESTADOS[estado]) {
        throw new BadRequestException('Estado não encontrado na memória.');
      }
      DEFAULT_ESTADOS[estado].handler = data.handler;
      DEFAULT_ESTADOS[estado].descricao = data.descricao || '';
      DEFAULT_ESTADOS[estado].config = data.config || {};
      DEFAULT_ESTADOS[estado].ativo = data.ativo !== false;
      return { estado };
    }

    return this.prisma.botEstadoConfig.update({
      where: { estado },
      data: {
        handler: data.handler,
        descricao: data.descricao || '',
        config: data.config || {},
        ativo: data.ativo !== false,
      },
    });
  }

  async excluirEstado(estado: string) {
    if (this.isDefaultMode()) {
      delete DEFAULT_ESTADOS[estado];
      delete DEFAULT_TRANSICOES[estado];
      // remove transitions targeting this state
      for (const origem in DEFAULT_TRANSICOES) {
        DEFAULT_TRANSICOES[origem] = DEFAULT_TRANSICOES[origem].filter(
          (t) => t.estadoDestino !== estado,
        );
      }
      return { ok: true };
    }

    await this.prisma.botEstadoConfig.delete({ where: { estado } });
    return { ok: true };
  }

  // ─── Transições ──────────────────────────────────────────────────────────

  async listarTransicoes() {
    if (this.isDefaultMode()) {
      const transicoes = [];
      for (const [estadoOrigem, lista] of Object.entries(DEFAULT_TRANSICOES)) {
        for (const t of lista) {
          transicoes.push({
            id: t.id,
            estadoOrigem,
            entrada: t.entrada,
            estadoDestino: t.estadoDestino,
            ativo: t.ativo !== false,
          });
        }
      }
      return transicoes.sort((a, b) =>
        a.estadoOrigem.localeCompare(b.estadoOrigem),
      );
    }

    return this.prisma.botEstadoTransicao.findMany({
      select: {
        id: true,
        estadoOrigem: true,
        entrada: true,
        estadoDestino: true,
        ativo: true,
      },
      orderBy: [{ estadoOrigem: 'asc' }, { entrada: 'asc' }],
    });
  }

  async criarTransicao(data: {
    estado_origem: string;
    entrada: string;
    estado_destino: string;
  }) {
    if (this.isDefaultMode()) {
      if (!DEFAULT_TRANSICOES[data.estado_origem]) {
        DEFAULT_TRANSICOES[data.estado_origem] = [];
      }
      const nova = {
        id: crypto.randomUUID(),
        entrada: data.entrada,
        estadoDestino: data.estado_destino,
        ativo: true,
      };
      DEFAULT_TRANSICOES[data.estado_origem].push(nova);
      return nova;
    }

    return this.prisma.botEstadoTransicao.create({
      data: {
        estadoOrigem: data.estado_origem,
        entrada: data.entrada,
        estadoDestino: data.estado_destino,
      },
    });
  }

  async atualizarTransicao(
    id: string,
    data: {
      estado_origem: string;
      entrada: string;
      estado_destino: string;
      ativo?: boolean;
    },
  ) {
    if (this.isDefaultMode()) {
      let encontrada = false;
      for (const origem in DEFAULT_TRANSICOES) {
        const idx = DEFAULT_TRANSICOES[origem].findIndex((t) => t.id === id);
        if (idx !== -1) {
          DEFAULT_TRANSICOES[origem].splice(idx, 1);
          encontrada = true;
          break;
        }
      }
      if (!DEFAULT_TRANSICOES[data.estado_origem]) {
        DEFAULT_TRANSICOES[data.estado_origem] = [];
      }
      DEFAULT_TRANSICOES[data.estado_origem].push({
        id,
        entrada: data.entrada,
        estadoDestino: data.estado_destino,
        ativo: data.ativo !== false,
      });
      return { id };
    }

    return this.prisma.botEstadoTransicao.update({
      where: { id },
      data: {
        estadoOrigem: data.estado_origem,
        entrada: data.entrada,
        estadoDestino: data.estado_destino,
        ativo: data.ativo !== false,
      },
    });
  }

  async excluirTransicao(id: string) {
    if (this.isDefaultMode()) {
      for (const origem in DEFAULT_TRANSICOES) {
        DEFAULT_TRANSICOES[origem] = DEFAULT_TRANSICOES[origem].filter(
          (t) => t.id !== id,
        );
      }
      return { ok: true };
    }

    await this.prisma.botEstadoTransicao.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Teste de Requisição ─────────────────────────────────────────────────

  async testarRequisicao(data: {
    config: any;
    valor?: string;
    variaveis?: Record<string, string>;
  }) {
    const { config, valor, variaveis } = data;
    if (!config?.url) throw new BadRequestException('URL não fornecida.');

    const interpolar = (texto: string, vars: Record<string, string>) =>
      typeof texto === 'string'
        ? texto.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
        : texto;

    const interpolarDeep = (obj: any, vars: Record<string, string>): any => {
      if (typeof obj === 'string') return interpolar(obj, vars);
      if (Array.isArray(obj))
        return obj.map((item) => interpolarDeep(item, vars));
      if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k, interpolarDeep(v, vars)]),
        );
      }
      return obj;
    };

    const metodo = (config.metodo || 'GET').toUpperCase();
    const tudo = {
      id: crypto.randomUUID(),
      valor: valor || '',
      ...(variaveis || {}),
    };
    const urlBase = interpolar(config.url, tudo);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.headers || {}),
    };

    const usandoBodyFixo =
      config.body &&
      typeof config.body === 'object' &&
      !Array.isArray(config.body);
    let bodyObj: any;

    if (usandoBodyFixo) {
      bodyObj = interpolarDeep(config.body, tudo);
    } else if (config.campoEnviar && typeof config.campoEnviar === 'string') {
      bodyObj = { [config.campoEnviar]: valor || variaveis?.valor || '' };
    } else {
      bodyObj = { ...tudo };
    }

    try {
      let urlFinal = urlBase;
      const fetchOptions: RequestInit = { headers };

      if (metodo === 'GET') {
        if (!usandoBodyFixo) {
          const params = new URLSearchParams(
            Object.fromEntries(
              Object.entries(bodyObj)
                .filter(([, v]) => v !== undefined && v !== '')
                .map(([k, v]) => [k, String(v)]),
            ),
          ).toString();
          if (params) urlFinal += (urlFinal.includes('?') ? '&' : '?') + params;
        }
      } else {
        fetchOptions.method = metodo;
        fetchOptions.body = JSON.stringify(bodyObj);
      }

      const response = await fetch(urlFinal, fetchOptions);
      const rsStr = await response.text();
      return { status: response.status, data: rsStr };
    } catch (err: any) {
      return { status: 500, erro: err.message };
    }
  }
}
