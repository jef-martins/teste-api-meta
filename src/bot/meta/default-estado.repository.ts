import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_ESTADOS,
  DEFAULT_TRANSICOES,
} from './default-state-machine.config';

/**
 * Implementação em memória do repositório de estados.
 * Usada quando BOT_STATE_MACHINE_PADRAO=true no .env.
 *
 * Não usa o banco de dados — todos os estados, transições e
 * sessões de usuário são mantidos em memória no processo Node.
 *
 * ⚠️ As sessões são perdidas se o servidor for reiniciado.
 *    Para persistência, deixe BOT_STATE_MACHINE_PADRAO=false
 *    e configure os estados no banco de dados.
 */
@Injectable()
export class DefaultEstadoRepository {
  private readonly logger = new Logger(DefaultEstadoRepository.name);

  /** Mapa em memória: chatId → estado atual */
  private readonly userStates = new Map<string, string>();

  /**
   * Retorna a configuração de um estado da máquina padrão.
   * Equivalente a bot_estado_config no banco de dados.
   */
  obterConfigEstado(estado: string): Promise<{
    handler: string;
    descricao: string;
    config: unknown;
  } | null> {
    const cfg = DEFAULT_ESTADOS[estado];
    if (!cfg || cfg.ativo === false) {
      this.logger.warn(
        `[DefaultRepo] Estado "${estado}" não existe na máquina padrão ou está inativo.`,
      );
      return Promise.resolve(null);
    }
    return Promise.resolve({
      handler: cfg.handler,
      descricao: cfg.descricao,
      config: cfg.config,
    });
  }

  /**
   * Retorna o próximo estado com base no estado atual e na entrada do usuário.
   * Busca correspondência exata primeiro; depois wildcard '*'.
   */
  buscarProximoEstado(
    estadoAtual: string,
    entrada: string,
    acceptWildcard = true,
  ): Promise<string | null> {
    const transicoes = DEFAULT_TRANSICOES[estadoAtual] ?? [];
    const transicoesAtivas = transicoes.filter((t) => t.ativo !== false);

    // 1. Correspondência exata
    const exactMatch = transicoesAtivas.find((t) => t.entrada === entrada);
    if (exactMatch) return Promise.resolve(exactMatch.estadoDestino);

    // 2. Wildcard fallback
    if (acceptWildcard && entrada !== '*') {
      const wildcard = transicoesAtivas.find((t) => t.entrada === '*');
      if (wildcard) return Promise.resolve(wildcard.estadoDestino);
    }

    return Promise.resolve(null);
  }

  /**
   * Retorna o estado atual do usuário da memória.
   * Retorna null se for a primeira interação do usuário.
   */
  obterEstadoUsuario(chatId: string): Promise<string | null> {
    return Promise.resolve(this.userStates.get(chatId) ?? null);
  }

  /**
   * Salva o estado atual do usuário na memória.
   * O parâmetro `nome` é aceito para compatibilidade de interface mas não usado.
   */
  salvarEstadoUsuario(
    chatId: string,
    estado: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _nome?: string | null,
  ): Promise<void> {
    this.userStates.set(chatId, estado);
    this.logger.debug(`[DefaultRepo] ${chatId} → ${estado}`);
    return Promise.resolve();
  }

  /**
   * No-op: o modo padrão não registra histórico de transições.
   * Mantido para compatibilidade de interface com EstadoRepository.
   */
  registrarTransicao(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _chatId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _estadoAnterior: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _estadoNovo: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _mensagemGatilho?: string | null,
  ): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Retorna sempre 'INICIO' como estado inicial do fluxo padrão.
   */
  obterEstadoInicial(): Promise<string> {
    return Promise.resolve('INICIO');
  }

  /**
   * Compatibilidade com StateMachineEngine:
   * no modo padrão não há variáveis globais de fluxo no banco.
   */
  obterVariaveisFluxoAtivo(): Promise<Record<string, string>> {
    return Promise.resolve({});
  }

  /**
   * Utilitário de diagnóstico: retorna a contagem de sessões ativas em memória.
   */
  contarSessoesAtivas(): number {
    return this.userStates.size;
  }

  /**
   * Utilitário de diagnóstico: reseta a sessão de um usuário específico.
   */
  resetarSessao(chatId: string): void {
    this.userStates.delete(chatId);
    this.logger.log(`[DefaultRepo] Sessão resetada para ${chatId}`);
  }
}
