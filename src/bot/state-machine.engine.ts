import { Injectable, Logger } from '@nestjs/common';
import { EstadoRepository } from './estado.repository';

@Injectable()
export class StateMachineEngine {
  private readonly logger = new Logger(StateMachineEngine.name);

  /** chatId → current state */
  estadosUsuarios = new Map<string, string>();

  /** chatId → captured data in memory { field: value } */
  dadosCapturados = new Map<string, Record<string, string>>();

  /** Current message context */
  mensagemAtual = '';
  nomeAtual: string | null = null;

  private estadosAvisados = new Set<string>();

  constructor(private estadoRepo: EstadoRepository) {}

  interpolar(texto: string, variaveis: Record<string, any> = {}): string {
    // Normaliza {{expr}} -> {expr} para suportar ambos os formatos
    const normalizado = texto.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    return normalizado.replace(/\{([^}]+)\}/g, (match, expr) => {
      const valor = this.resolverExprPath(expr.trim(), variaveis);
      return valor !== undefined && valor !== null ? String(valor) : match;
    });
  }

  private resolverExprPath(expr: string, ctx: Record<string, any>): any {
    // Transforma "a.b[0].c" em tokens ["a", "b", "0", "c"]
    const tokens = expr.replace(/\[(\d+)\]/g, '.$1').split('.');
    return tokens.reduce((acc: any, key: string) => {
      if (acc === undefined || acc === null) return undefined;
      return acc[key];
    }, ctx as any);
  }

  extrairValorPath(obj: any, path: string): any {
    if (!path) return obj;
    // Suporta notação de array: "data[0].nome" -> "data.0.nome"
    const normalizado = path.replace(/\[(\d+)\]/g, '.$1');
    return normalizado.split('.').reduce((acc: any, key: string) => acc?.[key], obj) ?? '';
  }

  salvarDado(chatId: string, campo: string, valor: string) {
    const atual = this.dadosCapturados.get(chatId) ?? {};
    this.dadosCapturados.set(chatId, { ...atual, [campo]: valor });
  }

  obterDados(chatId: string): Record<string, string> {
    return this.dadosCapturados.get(chatId) ?? {};
  }

  limparDados(chatId: string) {
    this.dadosCapturados.delete(chatId);
  }

  async process(
    message: any,
    chatId: string,
    entrada: string,
    nome: string | null,
    actionDelegate: any,
  ) {
    const estadoSalvo = await this.estadoRepo.obterEstadoUsuario(chatId);
    const estadoPadrao = await this.estadoRepo.obterEstadoInicial();
    this.estadosUsuarios.set(chatId, estadoSalvo ?? estadoPadrao);

    if (estadoSalvo && !this.estadosAvisados.has(chatId)) {
      this.logger.log(`[${chatId}] estado restaurado do banco: ${estadoSalvo}`);
      this.estadosAvisados.add(chatId);
    }

    const estadoAtual = this.estadosUsuarios.get(chatId)!;
    const config = await this.estadoRepo.obterConfigEstado(estadoAtual);

    if (!config) {
      this.logger.warn(`Estado "${estadoAtual}" não encontrado/ativo. Reiniciando para ${estadoPadrao}.`);
      await this.avancarEstado(chatId, estadoPadrao, entrada, nome);
      return;
    }

    this.logger.log(`[${chatId}] estado=${estadoAtual} → handler=${config.handler}`);
    this.mensagemAtual = entrada;
    this.nomeAtual = nome;

    // aguardarEntrada flag
    if (config.config?.aguardarEntrada && entrada) {
      this.logger.log(`[${chatId}] estado aguarda entrada → buscando transição para "${entrada}"`);
      await this.transitarPorEntrada(chatId, estadoAtual, entrada, message, true, nome, actionDelegate);
      return;
    }

    if (typeof actionDelegate[config.handler] === 'function') {
      await actionDelegate[config.handler](message, chatId, entrada, this);
    } else {
      this.logger.error(`Handler "${config.handler}" não existe no Delegate!`);
    }
  }

  async avancarEstado(chatId: string, proximo: string, gatilho?: string | null, nome?: string | null) {
    const anterior = this.estadosUsuarios.get(chatId) ?? 'NOVO';
    this.estadosUsuarios.set(chatId, proximo);
    this.logger.log(`[${chatId}] transição: ${anterior} → ${proximo}`);

    // Fire-and-forget persistence
    this.estadoRepo.salvarEstadoUsuario(chatId, proximo, nome ?? this.nomeAtual).catch(() => {});
    this.estadoRepo.registrarTransicao(chatId, anterior, proximo, gatilho ?? this.mensagemAtual).catch(() => {});
  }

  async transitarPorEntrada(
    chatId: string,
    estadoAtual: string,
    entrada: string,
    message: any,
    executarHandler = true,
    nome: string | null = null,
    actionDelegate?: any,
  ): Promise<string | null> {
    const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, entrada);
    if (!proximo) return null;

    await this.avancarEstado(chatId, proximo, this.mensagemAtual, nome);

    if (executarHandler && actionDelegate) {
      const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
      if (configProximo && typeof actionDelegate[configProximo.handler] === 'function') {
        await actionDelegate[configProximo.handler](message, chatId, '', this);
      }
    }

    return proximo;
  }
}
