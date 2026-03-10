import pool from './db';

class FluxoRepository {

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD de fluxos (bot_fluxo)
    // ─────────────────────────────────────────────────────────────────────────

    async criarFluxo(nome, descricao, flowJson) {
        const res = await pool.query(
            `INSERT INTO bot_fluxo (nome, descricao, flow_json)
             VALUES ($1, $2, $3::jsonb)
             RETURNING *`,
            [nome, descricao || '', JSON.stringify(flowJson)]
        );
        return res.rows[0];
    }

    async obterFluxo(id) {
        const res = await pool.query(
            `SELECT * FROM bot_fluxo WHERE id = $1`, [id]
        );
        return res.rows[0] || null;
    }

    async listarFluxos() {
        const res = await pool.query(
            `SELECT id, nome, descricao, versao, ativo, criado_em, atualizado_em
             FROM bot_fluxo ORDER BY atualizado_em DESC`
        );
        return res.rows;
    }

    async atualizarFluxo(id, { nome, descricao, flowJson, versao }) {
        const res = await pool.query(
            `UPDATE bot_fluxo
             SET nome = COALESCE($2, nome),
                 descricao = COALESCE($3, descricao),
                 flow_json = COALESCE($4::jsonb, flow_json),
                 versao = COALESCE($5, versao),
                 atualizado_em = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, nome, descricao, flowJson ? JSON.stringify(flowJson) : null, versao]
        );
        return res.rows[0] || null;
    }

    async excluirFluxo(id) {
        // Remove sessões de usuários que apontam para estados deste fluxo
        // (evita violação da FK bot_estado_usuario.estado_atual → bot_estado_config.estado)
        await pool.query(
            `DELETE FROM bot_estado_usuario
             WHERE estado_atual IN (SELECT estado FROM bot_estado_config WHERE flow_id = $1)`,
            [id]
        );
        await pool.query(`DELETE FROM bot_fluxo WHERE id = $1`, [id]);
    }

    async ativarFluxo(id) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Desativa TODOS os estados que pertencem a fluxos
            await client.query(
                `UPDATE bot_estado_config SET ativo = false WHERE flow_id IS NOT NULL`
            );

            // 2. Desativa TODAS as transições cujo estado_origem pertence a algum fluxo
            await client.query(
                `UPDATE bot_estado_transicao SET ativo = false
                 WHERE estado_origem IN (SELECT estado FROM bot_estado_config WHERE flow_id IS NOT NULL)`
            );

            // 3. Desativa todos os fluxos
            await client.query(
                `UPDATE bot_fluxo SET ativo = false`
            );

            // 4. Ativa os estados do fluxo selecionado
            await client.query(
                `UPDATE bot_estado_config SET ativo = true WHERE flow_id = $1`, [id]
            );

            // 5. Ativa as transições dos estados deste fluxo
            await client.query(
                `UPDATE bot_estado_transicao SET ativo = true
                 WHERE estado_origem IN (SELECT estado FROM bot_estado_config WHERE flow_id = $1)`, [id]
            );

            // 6. Ativa o fluxo
            await client.query(
                `UPDATE bot_fluxo SET ativo = true WHERE id = $1`, [id]
            );

            // 7. Encontra o estado inicial do fluxo (nó do tipo 'start')
            const { rows: startRows } = await client.query(
                `SELECT estado FROM bot_estado_config WHERE flow_id = $1 AND node_type = 'start' LIMIT 1`, [id]
            );
            const estadoInicial = startRows[0]?.estado || null;

            // 8. Reseta todos os usuários para o estado inicial do novo fluxo
            //    Assim eles entram no novo fluxo na próxima mensagem
            if (estadoInicial) {
                await client.query(
                    `UPDATE bot_estado_usuario SET estado_atual = $1, atualizado_em = NOW()`, [estadoInicial]
                );
            } else {
                // Se não encontrou nó start, deleta estados dos usuários para que o engine use o padrão
                await client.query(`DELETE FROM bot_estado_usuario`);
            }

            await client.query('COMMIT');

            return { estadoInicial };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Estados do fluxo (bot_estado_config com flow_id)
    // ─────────────────────────────────────────────────────────────────────────

    async limparEstadosDoFluxo(flowId) {
        // Remove sessões de usuários que apontam para estados deste fluxo (evita FK violation)
        await pool.query(
            `DELETE FROM bot_estado_usuario
             WHERE estado_atual IN (SELECT estado FROM bot_estado_config WHERE flow_id = $1)`,
            [flowId]
        );
        // Remove estados (CASCADE remove transições referenciando esses estados)
        await pool.query(
            `DELETE FROM bot_estado_config WHERE flow_id = $1`, [flowId]
        );
    }

    async salvarEstadosDoFluxo(flowId, estados) {
        for (const e of estados) {
            await pool.query(
                `INSERT INTO bot_estado_config (estado, handler, descricao, ativo, config, node_id, node_type, position, flow_id)
                 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9)`,
                [
                    e.estado,
                    e.handler,
                    e.descricao || '',
                    e.ativo !== false,
                    JSON.stringify(e.config || {}),
                    e.node_id || null,
                    e.node_type || null,
                    JSON.stringify(e.position || { x: 0, y: 0 }),
                    flowId
                ]
            );
        }
    }

    async salvarTransicoesDoFluxo(transicoes) {
        for (const t of transicoes) {
            await pool.query(
                `INSERT INTO bot_estado_transicao (estado_origem, entrada, estado_destino, ativo)
                 VALUES ($1, $2, $3, $4)`,
                [t.estado_origem, t.entrada, t.estado_destino, t.ativo !== false]
            );
        }
    }

    async obterEstadosDoFluxo(flowId) {
        const res = await pool.query(
            `SELECT estado, handler, descricao, ativo, config, node_id, node_type, position
             FROM bot_estado_config WHERE flow_id = $1 ORDER BY estado`,
            [flowId]
        );
        return res.rows;
    }

    async obterTransicoesDoFluxo(flowId) {
        const res = await pool.query(
            `SELECT t.id, t.estado_origem, t.entrada, t.estado_destino, t.ativo
             FROM bot_estado_transicao t
             INNER JOIN bot_estado_config e ON t.estado_origem = e.estado
             WHERE e.flow_id = $1
             ORDER BY t.estado_origem, t.entrada`,
            [flowId]
        );
        return res.rows;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Variáveis do fluxo (bot_fluxo_variaveis)
    // ─────────────────────────────────────────────────────────────────────────

    async salvarVariaveisDoFluxo(flowId, variaveis) {
        // Limpa existentes
        await pool.query(`DELETE FROM bot_fluxo_variaveis WHERE flow_id = $1`, [flowId]);
        for (const v of variaveis) {
            await pool.query(
                `INSERT INTO bot_fluxo_variaveis (flow_id, chave, valor_padrao)
                 VALUES ($1, $2, $3)`,
                [flowId, v.key || v.chave, v.value || v.valor_padrao || '']
            );
        }
    }

    async obterVariaveisDoFluxo(flowId) {
        const res = await pool.query(
            `SELECT chave, valor_padrao FROM bot_fluxo_variaveis WHERE flow_id = $1 ORDER BY chave`,
            [flowId]
        );
        return res.rows;
    }
}

export default new FluxoRepository();
