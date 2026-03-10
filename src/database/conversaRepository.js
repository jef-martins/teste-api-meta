const pool = require('./db');

class ConversaRepository {
    /**
     * Salva uma mensagem na tabela `conversa`.
     * @param {string|null} nome - Nome do remetente (pode ser null)
     * @param {object} dados - Objeto com os dados da mensagem (salvo como JSONB)
     * @param {string|null} quemEnviou - Número de quem enviou a mensagem
     * @param {string|null} paraQuem - Número de quem recebeu a mensagem
     * @param {string|null} mensagem - O texto da mensagem enviada
     * @returns {Promise<object>} - Registro salvo
     */
    async salvarMensagem(nome, dados, quemEnviou, paraQuem, mensagem) {
        const query = `
            INSERT INTO conversa (nome, dados, quem_enviou, para_quem, mensagem)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;

        const values = [nome || null, JSON.stringify(dados), quemEnviou || null, paraQuem || null, mensagem || null];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (err) {
            console.error('[DB] Erro ao salvar mensagem:', err.message);
            throw err;
        }
    }

    /**
     * Busca todas as conversas do banco (útil para debug/consulta via API)
     * @returns {Promise<Array>}
     */
    async listarConversas() {
        const query = `SELECT * FROM conversa ORDER BY criado_em DESC;`;
        const result = await pool.query(query);
        return result.rows;
    }
}

// Exportamos uma instância (padrão Singleton)
module.exports = new ConversaRepository();
