const express  = require('express');
const pool     = require('../database/db');
const path     = require('path');

const router = express.Router();

// Serve os arquivos estáticos da pasta /telas
router.use('/', express.static(path.join(__dirname, '../../telas')));

// ── Estados ──────────────────────────────────────────────────────────────────

router.get('/estados', async (req, res) => {
    const { rows } = await pool.query(
        `SELECT estado, handler, descricao, ativo, config
         FROM bot_estado_config ORDER BY estado`
    );
    res.json(rows);
});

router.post('/estados', async (req, res) => {
    const { estado, handler, descricao, config } = req.body;
    try {
        await pool.query(
            `INSERT INTO bot_estado_config (estado, handler, descricao, config)
             VALUES ($1, $2, $3, $4::jsonb)`,
            [estado, handler, descricao || '', JSON.stringify(config || {})]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

router.put('/estados/:estado', async (req, res) => {
    const { handler, descricao, config, ativo } = req.body;
    try {
        await pool.query(
            `UPDATE bot_estado_config
             SET handler=$1, descricao=$2, config=$3::jsonb, ativo=$4
             WHERE estado=$5`,
            [handler, descricao || '', JSON.stringify(config || {}), ativo !== false, req.params.estado]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

router.delete('/estados/:estado', async (req, res) => {
    try {
        await pool.query(`DELETE FROM bot_estado_config WHERE estado=$1`, [req.params.estado]);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

// ── Transições ────────────────────────────────────────────────────────────────

router.get('/transicoes', async (req, res) => {
    const { rows } = await pool.query(
        `SELECT id, estado_origem, entrada, estado_destino, ativo
         FROM bot_estado_transicao ORDER BY estado_origem, entrada`
    );
    res.json(rows);
});

router.post('/transicoes', async (req, res) => {
    const { estado_origem, entrada, estado_destino } = req.body;
    try {
        await pool.query(
            `INSERT INTO bot_estado_transicao (estado_origem, entrada, estado_destino)
             VALUES ($1, $2, $3)`,
            [estado_origem, entrada, estado_destino]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

router.put('/transicoes/:id', async (req, res) => {
    const { estado_origem, entrada, estado_destino, ativo } = req.body;
    try {
        await pool.query(
            `UPDATE bot_estado_transicao
             SET estado_origem=$1, entrada=$2, estado_destino=$3, ativo=$4
             WHERE id=$5`,
            [estado_origem, entrada, estado_destino, ativo !== false, req.params.id]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

router.delete('/transicoes/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM bot_estado_transicao WHERE id=$1`, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

module.exports = router;
