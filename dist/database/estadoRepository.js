"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class EstadoRepository {
    constructor() { }
    async carregarConfiguracoes() {
        console.log(`[DB] As configurações e transições agora são consultadas em tempo real do banco.`);
    }
    async obterConfigEstado(estado) {
        try {
            const res = await db_1.default.query(`SELECT handler, descricao, config FROM bot_estado_config WHERE estado = $1 AND ativo = TRUE`, [estado]);
            if (res.rows.length === 0)
                return null;
            const row = res.rows[0];
            return {
                handler: row.handler,
                descricao: row.descricao,
                config: row.config ?? {},
            };
        }
        catch (err) {
            console.error(`[DB] Erro ao consultar estado ${estado}:`, err.message);
            return null;
        }
    }
    async listarEstados() {
        try {
            const res = await db_1.default.query(`SELECT estado FROM bot_estado_config WHERE ativo = TRUE`);
            return res.rows.map((row) => row.estado);
        }
        catch (err) {
            console.error('[DB] Erro ao listar estados:', err.message);
            return [];
        }
    }
    async buscarProximoEstado(estadoAtual, entrada) {
        try {
            let res = await db_1.default.query(`SELECT estado_destino FROM bot_estado_transicao 
                 WHERE estado_origem = $1 AND entrada = $2 AND ativo = TRUE`, [estadoAtual, entrada]);
            if (res.rows.length > 0) {
                return res.rows[0].estado_destino;
            }
            if (entrada !== '*') {
                res = await db_1.default.query(`SELECT estado_destino FROM bot_estado_transicao 
                     WHERE estado_origem = $1 AND entrada = '*' AND ativo = TRUE`, [estadoAtual]);
                if (res.rows.length > 0) {
                    return res.rows[0].estado_destino;
                }
            }
            return null;
        }
        catch (err) {
            console.error(`[DB] Erro ao buscar próximo estado de ${estadoAtual} via ${entrada}:`, err.message);
            return null;
        }
    }
    async listarTransicoes(estadoOrigem) {
        try {
            const res = await db_1.default.query(`SELECT entrada, estado_destino AS destino FROM bot_estado_transicao WHERE estado_origem = $1 AND ativo = TRUE`, [estadoOrigem]);
            return res.rows;
        }
        catch (err) {
            console.error('[DB] Erro ao listar transições:', err.message);
            return [];
        }
    }
    async obterEstadoUsuario(chatId) {
        const query = `SELECT estado_atual FROM bot_estado_usuario WHERE chat_id = $1`;
        try {
            const result = await db_1.default.query(query, [chatId]);
            return result.rows[0]?.estado_atual ?? null;
        }
        catch (err) {
            console.error('[DB] Erro ao obter estado do usuário:', err.message);
            return null;
        }
    }
    async salvarEstadoUsuario(chatId, estado, nome = null) {
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
            await db_1.default.query(query, [chatId, nome, estado]);
        }
        catch (err) {
            console.error('[DB] Erro ao salvar estado do usuário:', err.message);
        }
    }
    async registrarTransicao(chatId, estadoAnterior, estadoNovo, mensagemGatilho = null) {
        const query = `
            INSERT INTO bot_estado_historico
                (chat_id, estado_anterior, estado_novo, mensagem_gatilho, criado_em)
            VALUES ($1, $2, $3, $4, NOW());
        `;
        try {
            await db_1.default.query(query, [
                chatId,
                estadoAnterior,
                estadoNovo,
                mensagemGatilho,
            ]);
        }
        catch (err) {
            console.error('[DB] Erro ao registrar transição:', err.message);
        }
    }
    async listarHistorico(chatId) {
        const query = `
            SELECT * FROM bot_estado_historico
            WHERE chat_id = $1
            ORDER BY criado_em DESC;
        `;
        try {
            const result = await db_1.default.query(query, [chatId]);
            return result.rows;
        }
        catch (err) {
            console.error('[DB] Erro ao listar histórico:', err.message);
            return [];
        }
    }
}
exports.default = new EstadoRepository();
//# sourceMappingURL=estadoRepository.js.map