import pool from './db';

class EstadoRepository {
  constructor() {}

  // ─────────────────────────────────────────────────────────────────────────
  // Carga inicial (deve ser chamada UMA vez na inicialização do bot)
  // ─────────────────────────────────────────────────────────────────────────

  async carregarConfiguracoes() {
    console.log(
      `[DB] As configurações e transições agora são consultadas em tempo real do banco.`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuração de estados (lê do cache em memória)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna a configuração completa de um estado fazendo query no banco.
   * @param {string} estado
   * @returns {Promise<{ handler: string, descricao: string, config: object } | null>}
   */
  async obterConfigEstado(estado) {
    try {
      const res = await pool.query(
        `SELECT handler, descricao, config FROM bot_estado_config WHERE estado = $1 AND ativo = TRUE`,
        [estado],
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        handler: row.handler,
        descricao: row.descricao,
        config: row.config ?? {},
      };
    } catch (err) {
      console.error(`[DB] Erro ao consultar estado ${estado}:`, err.message);
      return null;
    }
  }

  /**
   * Retorna a lista de todos os estados cadastrados e ativos.
   * @returns {Promise<string[]>}
   */
  async listarEstados() {
    try {
      const res = await pool.query(
        `SELECT estado FROM bot_estado_config WHERE ativo = TRUE`,
      );
      return res.rows.map((row) => row.estado);
    } catch (err) {
      console.error('[DB] Erro ao listar estados:', err.message);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Transições (lê do cache em memória)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dado o estado atual e a entrada do usuário, retorna o próximo estado (query real-time).
   * Primeiro tenta uma transição exata (ex: MENU + '1' → PROTOCOLO).
   * Se não encontrar, tenta a transição default (ex: MENU + '*' → null).
   * Retorna null se nenhuma transição foi configurada.
   *
   * @param {string} estadoAtual
   * @param {string} entrada
   * @returns {Promise<string|null>}
   */
  async buscarProximoEstado(estadoAtual, entrada) {
    try {
      // Tenta a transição exata primeiro
      let res = await pool.query(
        `SELECT estado_destino FROM bot_estado_transicao 
                 WHERE estado_origem = $1 AND entrada = $2 AND ativo = TRUE`,
        [estadoAtual, entrada],
      );

      if (res.rows.length > 0) {
        return res.rows[0].estado_destino;
      }

      // Fallback para curinga '*'
      if (entrada !== '*') {
        res = await pool.query(
          `SELECT estado_destino FROM bot_estado_transicao 
                     WHERE estado_origem = $1 AND entrada = '*' AND ativo = TRUE`,
          [estadoAtual],
        );
        if (res.rows.length > 0) {
          return res.rows[0].estado_destino;
        }
      }
      return null;
    } catch (err) {
      console.error(
        `[DB] Erro ao buscar próximo estado de ${estadoAtual} via ${entrada}:`,
        err.message,
      );
      return null;
    }
  }

  /**
   * Retorna todas as transições configuradas para um estado de origem no banco de dados.
   * Útil para montar menus dinâmicos no futuro.
   *
   * @param {string} estadoOrigem
   * @returns {Promise<Array<{ entrada: string, destino: string }>>}
   */
  async listarTransicoes(estadoOrigem) {
    try {
      const res = await pool.query(
        `SELECT entrada, estado_destino AS destino FROM bot_estado_transicao WHERE estado_origem = $1 AND ativo = TRUE`,
        [estadoOrigem],
      );
      return res.rows;
    } catch (err) {
      console.error('[DB] Erro ao listar transições:', err.message);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Estado do usuário (lê/escreve no banco)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Recupera o estado atual de um usuário na tabela bot_estado_usuario.
   * @param {string} chatId
   * @returns {Promise<string|null>}
   */
  async obterEstadoUsuario(chatId) {
    const query = `SELECT estado_atual FROM bot_estado_usuario WHERE chat_id = $1`;
    try {
      const result = await pool.query(query, [chatId]);
      return result.rows[0]?.estado_atual ?? null;
    } catch (err) {
      console.error('[DB] Erro ao obter estado do usuário:', err.message);
      return null;
    }
  }

  /**
   * Salva (insert ou update) o estado atual do usuário.
   * @param {string} chatId
   * @param {string} estado
   * @param {string|null} nome
   */
  async salvarEstadoUsuario(
    chatId: string,
    estado: string,
    nome: string | null = null,
  ) {
    const query = `
            INSERT INTO bot_estado_usuario (chat_id, nome, estado_atual, atualizado_em)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (chat_id)
            DO UPDATE SET
                estado_atual  = EXCLUDED.estado_atual,
                nome          = COALESCE(EXCLUDED.nome, bot_estado_usuario.nome),
                atualizado_em = NOW();
        `;
    try {
      await pool.query(query, [chatId, nome, estado]);
    } catch (err) {
      console.error('[DB] Erro ao salvar estado do usuário:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Histórico de transições
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra uma transição no histórico.
   * @param {string}      chatId
   * @param {string}      estadoAnterior
   * @param {string}      estadoNovo
   * @param {string|null} mensagemGatilho
   */
  async registrarTransicao(
    chatId: string,
    estadoAnterior: string,
    estadoNovo: string,
    mensagemGatilho: string | null = null,
  ) {
    const query = `
            INSERT INTO bot_estado_historico
                (chat_id, estado_anterior, estado_novo, mensagem_gatilho, criado_em)
            VALUES ($1, $2, $3, $4, NOW());
        `;
    try {
      await pool.query(query, [
        chatId,
        estadoAnterior,
        estadoNovo,
        mensagemGatilho,
      ]);
    } catch (err) {
      console.error('[DB] Erro ao registrar transição:', err.message);
    }
  }

  /**
   * Retorna o histórico de transições de um usuário.
   * @param {string} chatId
   * @returns {Promise<Array>}
   */
  async listarHistorico(chatId) {
    const query = `
            SELECT * FROM bot_estado_historico
            WHERE chat_id = $1
            ORDER BY criado_em DESC;
        `;
    try {
      const result = await pool.query(query, [chatId]);
      return result.rows;
    } catch (err) {
      console.error('[DB] Erro ao listar histórico:', err.message);
      return [];
    }
  }
}

export default new EstadoRepository();
