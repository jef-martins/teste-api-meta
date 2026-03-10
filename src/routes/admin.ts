import express from 'express';
import pool from '../database/db';
import path from 'path';

const router = express.Router();

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

// ── Teste de Requisição (Mock) ───────────────────────────────────────────────

router.post('/testar-req', async (req, res) => {
    const { config, valor, variaveis } = req.body;
    if (!config || !config.url) return res.status(400).json({ erro: 'URL não fornecida.' });

    const interpolar = (texto, varData) => 
        (typeof texto === 'string' ? texto.replace(/\{(\w+)\}/g, (_, k) => varData[k] ?? `{${k}}`) : texto);

    try {
        const metodo = (config.metodo || 'GET').toUpperCase();
        const tudo = { id: require('crypto').randomUUID(), valor: valor || '', ...(variaveis || {}) };
        const urlBase = interpolar(config.url, tudo);
        const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };

        let bodyObj;
        const usandoBodyFixo = config.body && typeof config.body === 'object' && !Array.isArray(config.body);

        if (usandoBodyFixo) {
            const interpolarDeep = (obj) => {
                if (typeof obj === 'string') return interpolar(obj, tudo);
                if (Array.isArray(obj)) return obj.map(item => interpolarDeep(item));
                if (typeof obj === 'object' && obj !== null) {
                    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, interpolarDeep(v)]));
                }
                return obj;
            };
            bodyObj = interpolarDeep(config.body);
        } else if (config.campoEnviar && typeof config.campoEnviar === 'string') {
            bodyObj = { [config.campoEnviar]: valor || (variaveis && variaveis.valor) || '' };
        } else {
            bodyObj = { ...tudo };
        }

        let rsStr;
        let rsStatus;
        const modReq = await import('node-fetch');
        const fetch = modReq.default;

        if (metodo === 'GET') {
            let urlFinal = urlBase;
            if (metodo === 'GET') {
                const searchParamsBody = Object.fromEntries(Object.entries(bodyObj).filter(([_,v]) => v !== undefined && v !== '')) as Record<string, string>;
                const queryParams = new URLSearchParams(searchParamsBody).toString();
                if (queryParams) {
                    urlFinal += (urlFinal.includes('?') ? '&' : '?') + queryParams;
                }
            }
            const fetchRes = await fetch(urlFinal, { headers, timeout: 15000 });
            rsStatus = fetchRes.status;
            rsStr = await fetchRes.text();
        } else {
            const fetchRes = await fetch(urlBase, {
                method: metodo,
                headers,
                body: JSON.stringify(bodyObj),
                timeout: 15000
            });
            rsStatus = fetchRes.status;
            rsStr = await fetchRes.text();
        }

        res.json({ status: rsStatus, data: rsStr });

    } catch (err) {
        res.status(500).json({ erro: err.message, status: 500 });
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

export default router;
