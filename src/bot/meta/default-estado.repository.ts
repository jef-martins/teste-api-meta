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
  async obterConfigEstado(estado: string): Promise<{
    handler: string;
    descricao: string;
    config: any;
  } | null> {
    const cfg = DEFAULT_ESTADOS[estado];
    if (!cfg) {
      this.logger.warn(
        `[DefaultRepo] Estado "${estado}" não existe na máquina padrão.`,
      );
      return null;
    }
    return {
      handler: cfg.handler,
      descricao: cfg.descricao,
      config: cfg.config,
    };
  }

  /**
   * Retorna o próximo estado com base no estado atual e na entrada do usuário.
   * Busca correspondência exata primeiro; depois wildcard '*'.
   */
  async buscarProximoEstado(
    estadoAtual: string,
    entrada: string,
  ): Promise<string | null> {
    const transicoes = DEFAULT_TRANSICOES[estadoAtual] ?? [];

    // 1. Correspondência exata
    const exactMatch = transicoes.find((t) => t.entrada === entrada);
    if (exactMatch) return exactMatch.estadoDestino;

    // 2. Wildcard fallback
    if (entrada !== '*') {
      const wildcard = transicoes.find((t) => t.entrada === '*');
      if (wildcard) return wildcard.estadoDestino;
    }

    return null;
  }

  /**
   * Retorna o estado atual do usuário da memória.
   * Retorna null se for a primeira interação do usuário.
   */
  async obterEstadoUsuario(chatId: string): Promise<string | null> {
    return this.userStates.get(chatId) ?? null;
  }

  /**
   * Salva o estado atual do usuário na memória.
   * O parâmetro `nome` é aceito para compatibilidade de interface mas não usado.
   */
  async salvarEstadoUsuario(
    chatId: string,
    estado: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _nome?: string | null,
  ): Promise<void> {
    this.userStates.set(chatId, estado);
    this.logger.debug(`[DefaultRepo] ${chatId} → ${estado}`);
  }

  /**
   * No-op: o modo padrão não registra histórico de transições.
   * Mantido para compatibilidade de interface com EstadoRepository.
   */
  async registrarTransicao(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _chatId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _estadoAnterior: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _estadoNovo: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _mensagemGatilho?: string | null,
  ): Promise<void> {
    // Nenhuma ação necessária no modo default
  }

  /**
   * Retorna sempre 'INICIO' como estado inicial do fluxo padrão.
   */
  async obterEstadoInicial(): Promise<string> {
    return 'INICIO';
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
 