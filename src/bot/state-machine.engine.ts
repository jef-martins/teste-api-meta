import { Injectable, Logger } from '@nestjs/common';
import { EstadoRepository } from './estado.repository';
import { GlobalKeywordService } from '../global-keyword/global-keyword.service';

type DelegateHandler = (
  message: unknown,
  chatId: string,
  corpo: string,
  engine: StateMachineEngine,
) => Promise<void> | void;

type EstadoConfig = {
  handler: string;
  descricao?: string | null;
  config?: unknown;
};

@Injectable()
export class StateMachineEngine {
  private readonly logger = new Logger(StateMachineEngine.name);

  estadosUsuarios = new Map<string, string>();
  dadosCapturados = new Map<string, Record<string, unknown>>();

  mensagemAtual = '';
  nomeAtual: string | null = null;

  private estadosAvisados = new Set<string>();

  constructor(
    private estadoRepo: EstadoRepository,
    private globalKeywordService: GlobalKeywordService,
  ) {}

  interpolar(texto: string, variaveis: Record<string, unknown> = {}): string {
    const normalizado = texto.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    return normalizado.replace(/\{([^}]+)\}/g, (match, expr: string) => {
      const valor = this.resolverExprPath(expr.trim(), variaveis);
      if (
        typeof valor === 'string' ||
        typeof valor === 'number' ||
        typeof valor === 'boolean' ||
        typeof valor === 'bigint'
      ) {
        return String(valor);
      }

      if (typeof valor === 'object' && valor !== null) {
        return JSON.stringify(valor);
      }

      return match;
    });
  }

  private resolverExprPath(
    expr: string,
    ctx: Record<string, unknown>,
  ): unknown {
    const tokens = expr.replace(/\[(\d+)\]/g, '.$1').split('.');
    return tokens.reduce<unknown>((acc, key) => {
      if (acc === undefined || acc === null || typeof acc !== 'object') {
        return undefined;
      }
      return (acc as Record<string, unknown>)[key];
    }, ctx);
  }

  extrairValorPath(obj: unknown, path: string): unknown {
    if (!path) return obj;

    const normalizado = path.replace(/\[(\d+)\]/g, '.$1');
    return (
      normalizado.split('.').reduce<unknown>((acc, key) => {
        if (acc === undefined || acc === null || typeof acc !== 'object') {
          return undefined;
        }
        return (acc as Record<string, unknown>)[key];
      }, obj) ?? ''
    );
  }

  salvarDado(chatId: string, campo: string, valor: unknown) {
    const atual = this.dadosCapturados.get(chatId) ?? {};
    this.dadosCapturados.set(chatId, { ...atual, [campo]: valor });
  }

  obterDados(chatId: string): Record<string, unknown> {
    return this.dadosCapturados.get(chatId) ?? {};
  }

  limparDados(chatId: string) {
    this.dadosCapturados.delete(chatId);
  }

  private obterHandlerDelegate(
    actionDelegate: unknown,
    handlerNome: string,
  ): DelegateHandler | null {
    if (!actionDelegate || typeof actionDelegate !== 'object') {
      return null;
    }

    const candidato = (actionDelegate as Record<string, unknown>)[handlerNome];
    if (typeof candidato !== 'function') {
      return null;
    }

    return candidato as DelegateHandler;
  }

  private deveAguardarEntrada(config: unknown): boolean {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const aguardarEntrada = (config as Record<string, unknown>).aguardarEntrada;
    return Boolean(aguardarEntrada);
  }

  async process(
    message: unknown,
    chatId: string,
    entradaOriginal: string,
    nome: string | null,
    actionDelegate: unknown,
  ) {
    const entradaBruta =
      typeof entradaOriginal === 'string' ? entradaOriginal.trim() : '';
    const entradaNormalizada = entradaBruta.toLowerCase();

    const estadoPadrao = await this.estadoRepo.obterEstadoInicial();

    let estadoAtualUsuario = this.estadosUsuarios.get(chatId);
    if (!estadoAtualUsuario) {
      const estadoSalvo = await this.estadoRepo.obterEstadoUsuario(chatId);
      estadoAtualUsuario = estadoSalvo ?? estadoPadrao;
      this.estadosUsuarios.set(chatId, estadoAtualUsuario);

      if (estadoSalvo && !this.estadosAvisados.has(chatId)) {
        this.logger.log(
          `[${chatId}] estado restaurado do banco: ${estadoSalvo}`,
        );
        this.estadosAvisados.add(chatId);
      }
    }

    if (!this.dadosCapturados.has(chatId)) {
      const varsGlobais = await this.estadoRepo.obterVariaveisFluxoAtivo();
      if (Object.keys(varsGlobais).length > 0) {
        this.dadosCapturados.set(chatId, { ...varsGlobais });
        this.logger.log(
          `[${chatId}] variáveis globais carregadas: ${Object.keys(varsGlobais).join(', ')}`,
        );
      }
    }

    this.mensagemAtual = entradaNormalizada;
    this.nomeAtual = nome;

    const keywordGlobal =
      await this.globalKeywordService.buscarKeywordAtiva(entradaBruta);
    if (keywordGlobal) {
      const configDestino = (await this.estadoRepo.obterConfigEstado(
        keywordGlobal.estadoDestino,
      )) as EstadoConfig | null;

      if (!configDestino) {
        this.logger.warn(
          `[${chatId}] keyword global "${keywordGlobal.keyword}" aponta para estado inválido/inativo: ${keywordGlobal.estadoDestino}`,
        );
      } else {
        this.logger.log(
          `[${chatId}] keyword global "${keywordGlobal.keyword}" -> ${keywordGlobal.estadoDestino}`,
        );

        await this.avancarEstado(
          chatId,
          keywordGlobal.estadoDestino,
          entradaBruta,
          nome,
        );

        const handlerDestino = this.obterHandlerDelegate(
          actionDelegate,
          configDestino.handler,
        );

        if (handlerDestino) {
          await handlerDestino(message, chatId, '', this);
        } else {
          this.logger.error(
            `Handler "${configDestino.handler}" não existe no Delegate!`,
          );
        }

        return;
      }
    }

    const estadoAtual = this.estadosUsuarios.get(chatId) ?? estadoPadrao;
    const config = (await this.estadoRepo.obterConfigEstado(
      estadoAtual,
    )) as EstadoConfig | null;

    if (!config) {
      this.logger.warn(
        `Estado "${estadoAtual}" não encontrado/ativo. Reiniciando para ${estadoPadrao}.`,
      );
      await this.avancarEstado(chatId, estadoPadrao, entradaBruta, nome);
      return;
    }

    this.logger.log(
      `[${chatId}] estado=${estadoAtual} -> handler=${config.handler}`,
    );
    this.mensagemAtual = entradaBruta;
    this.nomeAtual = nome;

    if (entradaNormalizada) {
      if (this.deveAguardarEntrada(config.config)) {
        this.logger.log(
          `[${chatId}] estado aguarda entrada -> buscando transição para "${entradaNormalizada}"`,
        );

        const proximo = await this.transitarPorEntrada(
          chatId,
          estadoAtual,
          entradaNormalizada,
          message,
          true,
          nome,
          actionDelegate,
          false,
        );

        if (proximo) {
          return;
        }

        this.logger.log(
          `[${chatId}] sem transição no estado "${estadoAtual}" -> reiniciando fluxo a partir de "${estadoPadrao}"`,
        );
        this.estadosAvisados.delete(chatId);

        await this.avancarEstado(chatId, estadoPadrao, entradaBruta, nome);

        const configInicial = (await this.estadoRepo.obterConfigEstado(
          estadoPadrao,
        )) as EstadoConfig | null;
        if (!configInicial) {
          return;
        }

        const handlerInicial = this.obterHandlerDelegate(
          actionDelegate,
          configInicial.handler,
        );

        if (handlerInicial) {
          await handlerInicial(message, chatId, '', this);
        }

        return;
      }

      const handlerAtual = this.obterHandlerDelegate(
        actionDelegate,
        config.handler,
      );
      if (handlerAtual) {
        await handlerAtual(message, chatId, entradaNormalizada, this);
      } else {
        this.logger.error(
          `Handler "${config.handler}" não existe no Delegate!`,
        );
      }
    }
  }

  async avancarEstado(
    chatId: string,
    proximo: string,
    gatilho?: string | null,
    nome?: string | null,
  ) {
    const anterior = this.estadosUsuarios.get(chatId) ?? 'NOVO';
    this.estadosUsuarios.set(chatId, proximo);
    this.logger.log(`[${chatId}] transição: ${anterior} -> ${proximo}`);

    await Promise.allSettled([
      this.estadoRepo.salvarEstadoUsuario(
        chatId,
        proximo,
        nome ?? this.nomeAtual,
      ),
      this.estadoRepo.registrarTransicao(
        chatId,
        anterior,
        proximo,
        gatilho ?? this.mensagemAtual,
      ),
    ]);
  }

  async transitarPorEntrada(
    chatId: string,
    estadoAtual: string,
    entrada: string,
    message: unknown,
    executarHandler = true,
    nome: string | null = null,
    actionDelegate?: unknown,
    acceptWildcard = true,
  ): Promise<string | null> {
    const proximo = await this.estadoRepo.buscarProximoEstado(
      estadoAtual,
      entrada,
      acceptWildcard,
    );
    if (!proximo) {
      return null;
    }

    await this.avancarEstado(chatId, proximo, this.mensagemAtual, nome);

    if (executarHandler && actionDelegate) {
      const configProximo = (await this.estadoRepo.obterConfigEstado(
        proximo,
      )) as EstadoConfig | null;
      if (!configProximo) {
        return proximo;
      }

      const handlerProximo = this.obterHandlerDelegate(
        actionDelegate,
        configProximo.handler,
      );
      if (handlerProximo) {
        await handlerProximo(message, chatId, '', this);
      }
    }

    return proximo;
  }
}
