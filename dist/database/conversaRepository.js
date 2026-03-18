"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class ConversaRepository {
    async salvarMensagem(nome, dados, quemEnviou, paraQuem, mensagem) {
        const query = `
            INSERT INTO conversa (nome, dados, quem_enviou, para_quem, mensagem)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [
            nome || null,
            JSON.stringify(dados),
            quemEnviou || null,
            paraQuem || null,
            mensagem || null,
        ];
        try {
            const result = await db_1.default.query(query, values);
            return result.rows[0];
        }
        catch (err) {
            console.error('[DB] Erro ao salvar mensagem:', err.message);
            throw err;
        }
    }
    async listarConversas() {
        const query = `SELECT * FROM conversa ORDER BY criado_em DESC;`;
        const result = await db_1.default.query(query);
        return result.rows;
    }
}
exports.default = new ConversaRepository();
//# sourceMappingURL=conversaRepository.js.map