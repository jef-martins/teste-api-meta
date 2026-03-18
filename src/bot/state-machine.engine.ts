import { Injectable, Logger } from '@nestjs/common';
import { EstadoRepository } from './estado.repository';
import { GlobalKeywordService } from '../global-keyword/global-keyword.service';

@Injectable()
export class StateMachineEngine {
  private readonly logger = new Logger(StateMachineEngine.name);

  /** chatId → current state */
  estadosUsuarios = new Map<string, string>();

  /** chatId → captured data in memory { field: value } */
  dadosCapturados = new Map<string, Record<string, any>>();

  /** Current message context */
  mensagemAtual = '';
  nomeAtual: string | null = null;

  private estadosAvisados = new Set<string>();

  constructor(
    private estadoRepo: EstadoRepository,
    private globalKeywordService: GlobalKeywordService,
  ) {}

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
    return (
      normalizado
        .split('.')
        .reduce((acc: any, key: string) => acc?.[key], obj) ?? ''
    );
  }

  salvarDado(chatId: string, campo: string, valor: any) {
    const atual = this.dadosCapturados.get(chatId) ?? {};
    this.dadosCapturados.set(chatId, { ...atual, [campo]: valor });
  }

  obterDados(chatId: string): Record<string, any> {
    return this.dadosCapturados.get(chatId) ?? {};
  }

  limparDados(chatId: string) {
    this.dadosCapturados.delete(chatId);
  }

  async process(
    message: any,
    chatId: string,
    entradaOriginal: string,
    nome: string | null,
    actionDelegate: any,
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

    // Carregar variáveis globais do fluxo ativo na primeira interação
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
      const configDestino = await this.estadoRepo.obterConfigEstado(
        keywordGlobal.estadoDestino,
      );

      if (!configDestino) {
        this.logger.warn(
          `[${chatId}] keyword global "${keywordGlobal.keyword}" aponta para estado inválido/inativo: ${keywordGlobal.estadoDestino}`,
        );
      } else {
        this.logger.log(
          `[${chatId}] keyword global "${keywordGlobal.keyword}" → ${keywordGlobal.estadoDestino}`,
        );
        await this.avancarEstado(
          chatId,
          keywordGlobal.estadoDestino,
          entradaBruta,
          nome,
        );

        if (typeof actionDelegate[configDestino.handler] === 'function') {
          await actionDelegate[configDestino.handler](
            message,
            chatId,
            '',
            this,
          );
        } else {
          this.logger.error(
            `Handler "${configDestino.handler}" não existe no Delegate!`,
          );
        }
        return;
      }
    }

    const estadoAtual = this.estadosUsuarios.get(chatId)!;
    const config = await this.estadoRepo.obterConfigEstado(estadoAtual);

    if (!config) {
      this.logger.warn(
        `Estado "${estadoAtual}" não encontrado/ativo. Reiniciando para ${estadoPadrao}.`,
      );
      await this.avancarEstado(chatId, estadoPadrao, entradaBruta, nome);
      return;
    }

    this.logger.log(
      `[${chatId}] estado=${estadoAtual} → handler=${config.handler}`,
    );
    this.mensagemAtual = entradaBruta;
    this.nomeAtual = nome;

    // Se houver entrada, tenta transição EXATA primeiro (ex: "cancelar", "menu")
    // Não usamos wildcard aqui para não roubar a entrada de estados que capturam dados (ex: CEP, CPF)
    if (entradaNormalizada) {
      const proximo = await this.transitarPorEntrada(
        chatId,
        estadoAtual,
        entradaNormalizada,
        message,
        true,
        nome,
        actionDelegate,
        false, // acceptWildcard = false
      );

      // Se encontrou rota exata, encerra o processamento
      if (proximo) return;
    }

    // Se não transitou (ou não houve entrada), executa o handler do estado atual
    if (typeof actionDelegate[config.handler] === 'function') {
      await actionDelegate[config.handler](
        message,
        chatId,
        entradaNormalizada,
        this,
      );
    } else {
      this.logger.error(`Handler "${config.handler}" não existe no Delegate!`);
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
    this.logger.log(`[${chatId}] transição: ${anterior} → ${proximo}`);

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
    message: any,
    executarHandler = true,
    nome: string | null = null,
    actionDelegate?: any,
    acceptWildcard = true,
  ): Promise<string | null> {
    const proximo = await this.estadoRepo.buscarProximoEstado(
      estadoAtual,
      entrada,
      acceptWildcard,
    );
    if (!proximo) return null;

    await this.avancarEstado(chatId, proximo, this.mensagemAtual, nome);

    if (executarHandler && actionDelegate) {
      const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
      if (
        configProximo &&
        typeof actionDelegate[configProximo.handler] === 'function'
      ) {
        await actionDelegate[configProximo.handler](message, chatId, '', this);
      }
    }

    return proximo;
  }
}
