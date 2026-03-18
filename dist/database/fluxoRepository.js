"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class FluxoRepository {
    async criarFluxo(nome, descricao, flowJson) {
        const res = await db_1.default.query(`INSERT INTO bot_fluxo (nome, descricao, flow_json)
             VALUES ($1, $2, $3::jsonb)
             RETURNING *`, [nome, descricao || '', JSON.stringify(flowJson)]);
        return res.rows[0];
    }
    async obterFluxo(id) {
        const res = await db_1.default.query(`SELECT * FROM bot_fluxo WHERE id = $1`, [id]);
        return res.rows[0] || null;
    }
    async listarFluxos() {
        const res = await db_1.default.query(`SELECT id, nome, descricao, versao, ativo, criado_em, atualizado_em
             FROM bot_fluxo ORDER BY atualizado_em DESC`);
        return res.rows;
    }
    async atualizarFluxo(id, { nome, descricao, flowJson, versao }) {
        const res = await db_1.default.query(`UPDATE bot_fluxo
             SET nome = COALESCE($2, nome),
                 descricao = COALESCE($3, descricao),
                 flow_json = COALESCE($4::jsonb, flow_json),
                 versao = COALESCE($5, versao),
                 atualizado_em = NOW()
             WHERE id = $1
             RETURNING *`, [id, nome, descricao, flowJson ? JSON.stringify(flowJson) : null, versao]);
        return res.rows[0] || null;
    }
    async excluirFluxo(id) {
        await db_1.default.query(`DELETE FROM bot_estado_usuario
             WHERE estado_atual IN (SELECT estado FROM bot_estado_config WHERE flow_id = $1)`, [id]);
        await db_1.default.query(`DELETE FROM bot_fluxo WHERE id = $1`, [id]);
    }
    async ativarFluxo(id) {
        const client = await db_1.default.connect();
        try {
            await client.query('BEGIN');
            await client.query(`UPDATE bot_estado_config SET ativo = false WHERE flow_id IS NOT NULL`);
            await client.query(`UPDATE bot_estado_transicao SET ativo = false
                 WHERE estado_origem IN (SELECT estado FROM bot_estado_config WHERE flow_id IS NOT NULL)`);
            await client.query(`UPDATE bot_fluxo SET ativo = false`);
            await client.query(`UPDATE bot_estado_config SET ativo = true WHERE flow_id = $1`, [id]);
            await client.query(`UPDATE bot_estado_transicao SET ativo = true
                 WHERE estado_origem IN (SELECT estado FROM bot_estado_config WHERE flow_id = $1)`, [id]);
            await client.query(`UPDATE bot_fluxo SET ativo = true WHERE id = $1`, [
                id,
            ]);
            const { rows: startRows } = await client.query(`SELECT estado FROM bot_estado_config WHERE flow_id = $1 AND node_type = 'start' LIMIT 1`, [id]);
            const estadoInicial = startRows[0]?.estado || null;
            if (estadoInicial) {
                await client.query(`UPDATE bot_estado_usuario SET estado_atual = $1, atualizado_em = NOW()`, [estadoInicial]);
            }
            else {
                await client.query(`DELETE FROM bot_estado_usuario`);
            }
            await client.query('COMMIT');
            return { estadoInicial };
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    async limparEstadosDoFluxo(flowId) {
        await db_1.default.query(`DELETE FROM bot_estado_usuario
             WHERE estado_atual IN (SELECT estado FROM bot_estado_config WHERE flow_id = $1)`, [flowId]);
        await db_1.default.query(`DELETE FROM bot_estado_config WHERE flow_id = $1`, [
            flowId,
        ]);
    }
    async salvarEstadosDoFluxo(flowId, estados) {
        for (const e of estados) {
            await db_1.default.query(`INSERT INTO bot_estado_config (estado, handler, descricao, ativo, config, node_id, node_type, position, flow_id)
                 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9)`, [
                e.estado,
                e.handler,
                e.descricao || '',
                e.ativo !== false,
                JSON.stringify(e.config || {}),
                e.node_id || null,
                e.node_type || null,
                JSON.stringify(e.position || { x: 0, y: 0 }),
                flowId,
            ]);
        }
    }
    async salvarTransicoesDoFluxo(transicoes) {
        for (const t of transicoes) {
            await db_1.default.query(`INSERT INTO bot_estado_transicao (estado_origem, entrada, estado_destino, ativo)
                 VALUES ($1, $2, $3, $4)`, [t.estado_origem, t.entrada, t.estado_destino, t.ativo !== false]);
        }
    }
    async obterEstadosDoFluxo(flowId) {
        const res = await db_1.default.query(`SELECT estado, handler, descricao, ativo, config, node_id, node_type, position
             FROM bot_estado_config WHERE flow_id = $1 ORDER BY estado`, [flowId]);
        return res.rows;
    }
    async obterTransicoesDoFluxo(flowId) {
        const res = await db_1.default.query(`SELECT t.id, t.estado_origem, t.entrada, t.estado_destino, t.ativo
             FROM bot_estado_transicao t
             INNER JOIN bot_estado_config e ON t.estado_origem = e.estado
             WHERE e.flow_id = $1
             ORDER BY t.estado_origem, t.entrada`, [flowId]);
        return res.rows;
    }
    async salvarVariaveisDoFluxo(flowId, variaveis) {
        await db_1.default.query(`DELETE FROM bot_fluxo_variaveis WHERE flow_id = $1`, [
            flowId,
        ]);
        for (const v of variaveis) {
            await db_1.default.query(`INSERT INTO bot_fluxo_variaveis (flow_id, chave, valor_padrao)
                 VALUES ($1, $2, $3)`, [flowId, v.key || v.chave, v.value || v.valor_padrao || '']);
        }
    }
    async obterVariaveisDoFluxo(flowId) {
        const res = await db_1.default.query(`SELECT chave, valor_padrao FROM bot_fluxo_variaveis WHERE flow_id = $1 ORDER BY chave`, [flowId]);
        return res.rows;
    }
}
exports.default = new FluxoRepository();
//# sourceMappingURL=fluxoRepository.js.map