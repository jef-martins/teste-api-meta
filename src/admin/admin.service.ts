import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ─── Estados ─────────────────────────────────────────────────────────────

  async listarEstados() {
    return this.prisma.botEstadoConfig.findMany({
      select: { estado: true, handler: true, descricao: true, ativo: true, config: true },
      orderBy: { estado: 'asc' },
    });
  }

  async criarEstado(data: { estado: string; handler: string; descricao?: string; config?: any }) {
    return this.prisma.botEstadoConfig.create({
      data: {
        estado: data.estado,
        handler: data.handler,
        descricao: data.descricao || '',
        config: data.config || {},
      },
    });
  }

  async atualizarEstado(estado: string, data: { handler: string; descricao?: string; config?: any; ativo?: boolean }) {
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
    await this.prisma.botEstadoConfig.delete({ where: { estado } });
    return { ok: true };
  }

  // ─── Transições ──────────────────────────────────────────────────────────

  async listarTransicoes() {
    return this.prisma.botEstadoTransicao.findMany({
      select: { id: true, estadoOrigem: true, entrada: true, estadoDestino: true, ativo: true },
      orderBy: [{ estadoOrigem: 'asc' }, { entrada: 'asc' }],
    });
  }

  async criarTransicao(data: { estado_origem: string; entrada: string; estado_destino: string }) {
    return this.prisma.botEstadoTransicao.create({
      data: {
        estadoOrigem: data.estado_origem,
        entrada: data.entrada,
        estadoDestino: data.estado_destino,
      },
    });
  }

  async atualizarTransicao(id: string, data: { estado_origem: string; entrada: string; estado_destino: string; ativo?: boolean }) {
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
    await this.prisma.botEstadoTransicao.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Teste de Requisição ─────────────────────────────────────────────────

  async testarRequisicao(data: { config: any; valor?: string; variaveis?: Record<string, string> }) {
    const { config, valor, variaveis } = data;
    if (!config?.url) throw new BadRequestException('URL não fornecida.');

    const interpolar = (texto: string, vars: Record<string, string>) =>
      typeof texto === 'string' ? texto.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`) : texto;

    const interpolarDeep = (obj: any, vars: Record<string, string>): any => {
      if (typeof obj === 'string') return interpolar(obj, vars);
      if (Array.isArray(obj)) return obj.map((item) => interpolarDeep(item, vars));
      if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, interpolarDeep(v, vars)]));
      }
      return obj;
    };

    const metodo = (config.metodo || 'GET').toUpperCase();
    const tudo = { id: crypto.randomUUID(), valor: valor || '', ...(variaveis || {}) };
    const urlBase = interpolar(config.url, tudo);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(config.headers || {}) };

    const usandoBodyFixo = config.body && typeof config.body === 'object' && !Array.isArray(config.body);
    let bodyObj: any;

    if (usandoBodyFixo) {
      bodyObj = interpolarDeep(config.body, tudo);
    } else if (config.campoEnviar && typeof config.campoEnviar === 'string') {
      bodyObj = { [config.campoEnviar]: valor || (variaveis?.valor) || '' };
    } else {
      bodyObj = { ...tudo };
    }

    try {
      let urlFinal = urlBase;
      const fetchOptions: RequestInit = { headers };

      if (metodo === 'GET') {
        if (!usandoBodyFixo) {
          const params = new URLSearchParams(
            Object.fromEntries(Object.entries(bodyObj).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])),
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
