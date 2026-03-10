const express = require('express');
const pool = require('../database/db');

const router = express.Router();

// ── Sessões ativas (usuários com estado atual) ──────────────────────────────

router.get('/sessoes', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT u.chat_id, u.nome, u.estado_atual, u.atualizado_em,
                   e.handler, e.descricao AS estado_descricao
            FROM bot_estado_usuario u
            LEFT JOIN bot_estado_config e ON u.estado_atual = e.estado
            ORDER BY u.atualizado_em DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── Detalhes de sessão ──────────────────────────────────────────────────────

router.get('/sessoes/:chatId', async (req, res) => {
    try {
        const { rows: usuario } = await pool.query(
            `SELECT * FROM bot_estado_usuario WHERE chat_id = $1`,
            [req.params.chatId]
        );
        if (usuario.length === 0) return res.status(404).json({ erro: 'Sessão não encontrada' });

        const { rows: historico } = await pool.query(
            `SELECT * FROM bot_estado_historico WHERE chat_id = $1 ORDER BY criado_em DESC LIMIT 50`,
            [req.params.chatId]
        );

        const { rows: mensagens } = await pool.query(
            `SELECT * FROM conversa WHERE quem_enviou = $1 OR para_quem = $1 ORDER BY criado_em DESC LIMIT 50`,
            [req.params.chatId]
        );

        res.json({
            usuario: usuario[0],
            historico,
            mensagens
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── Histórico de transições de um usuário ───────────────────────────────────

router.get('/historico/:chatId', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM bot_estado_historico WHERE chat_id = $1 ORDER BY criado_em DESC LIMIT 100`,
            [req.params.chatId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── Dashboard (estatísticas) ────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
    try {
        // Total de sessões ativas
        const { rows: [{ count: totalSessoes }] } = await pool.query(
            `SELECT COUNT(*) FROM bot_estado_usuario`
        );

        // Sessões ativas hoje
        const { rows: [{ count: sessoesHoje }] } = await pool.query(
            `SELECT COUNT(*) FROM bot_estado_usuario WHERE atualizado_em >= CURRENT_DATE`
        );

        // Total de mensagens
        const { rows: [{ count: totalMensagens }] } = await pool.query(
            `SELECT COUNT(*) FROM conversa`
        );

        // Mensagens hoje
        const { rows: [{ count: mensagensHoje }] } = await pool.query(
            `SELECT COUNT(*) FROM conversa WHERE criado_em >= CURRENT_DATE`
        );

        // Total de transições hoje
        const { rows: [{ count: transicoesHoje }] } = await pool.query(
            `SELECT COUNT(*) FROM bot_estado_historico WHERE criado_em >= CURRENT_DATE`
        );

        // Estados mais visitados (top 10)
        const { rows: estadosMaisUsados } = await pool.query(`
            SELECT estado_novo AS estado, COUNT(*) AS total
            FROM bot_estado_historico
            WHERE criado_em >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY estado_novo
            ORDER BY total DESC
            LIMIT 10
        `);

        // Mensagens por dia (últimos 7 dias)
        const { rows: mensagensPorDia } = await pool.query(`
            SELECT DATE(criado_em) AS dia, COUNT(*) AS total
            FROM conversa
            WHERE criado_em >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(criado_em)
            ORDER BY dia
        `);

        // Fluxos salvos
        const { rows: [{ count: totalFluxos }] } = await pool.query(
            `SELECT COUNT(*) FROM bot_fluxo`
        );

        // Fluxo ativo
        const { rows: fluxoAtivo } = await pool.query(
            `SELECT id, nome FROM bot_fluxo WHERE ativo = true LIMIT 1`
        );

        res.json({
            totalSessoes: parseInt(totalSessoes),
            sessoesHoje: parseInt(sessoesHoje),
            totalMensagens: parseInt(totalMensagens),
            mensagensHoje: parseInt(mensagensHoje),
            transicoesHoje: parseInt(transicoesHoje),
            totalFluxos: parseInt(totalFluxos),
            fluxoAtivo: fluxoAtivo[0] || null,
            estadosMaisUsados,
            mensagensPorDia
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

module.exports = router;
