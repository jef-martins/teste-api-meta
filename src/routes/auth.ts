import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../database/db';
import { autenticar, apenasAdmin, gerarToken } from '../middleware/auth';

const router = express.Router();

// ── Login ─────────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT id, email, senha_hash, nome, papel, ativo FROM bot_usuario WHERE email = $1`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const usuario = rows[0];
        if (!usuario.ativo) {
            return res.status(401).json({ erro: 'Usuário inativo' });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const token = gerarToken(usuario);
        res.json({
            token,
            usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome, papel: usuario.papel }
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── Verificar token ───────────────────────────────────────────────────────────

router.get('/me', autenticar, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, email, nome, papel FROM bot_usuario WHERE id = $1`,
            [req.usuario.id]
        );
        if (rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── Criar primeiro usuário (setup) ────────────────────────────────────────────

router.post('/setup', async (req, res) => {
    try {
        // Só permite criar se não existe nenhum usuário
        const { rows: existentes } = await pool.query(`SELECT COUNT(*) FROM bot_usuario`);
        if (parseInt(existentes[0].count) > 0) {
            return res.status(403).json({ erro: 'Setup já realizado. Use login.' });
        }

        const { email, senha, nome } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);
        const { rows } = await pool.query(
            `INSERT INTO bot_usuario (email, senha_hash, nome, papel) VALUES ($1, $2, $3, 'admin') RETURNING id, email, nome, papel`,
            [email, senhaHash, nome || 'Admin']
        );

        const token = gerarToken(rows[0]);
        res.json({ token, usuario: rows[0] });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── Registro público de admin (DEV ONLY — remover antes de ir pra produção) ──

router.post('/register', async (req, res) => {
    const { email, senha, nome } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        const { rows } = await pool.query(
            `INSERT INTO bot_usuario (email, senha_hash, nome, papel)
             VALUES ($1, $2, $3, 'admin')
             RETURNING id, email, nome, papel`,
            [email, senhaHash, nome || 'Admin']
        );

        const token = gerarToken(rows[0]);
        res.status(201).json({ token, usuario: rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }
        res.status(500).json({ erro: err.message });
    }
});

// ── CRUD de Usuários (apenas admin) ───────────────────────────────────────────

router.get('/usuarios', autenticar, apenasAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, email, nome, papel, ativo, criado_em, atualizado_em
             FROM bot_usuario ORDER BY criado_em DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

router.post('/usuarios', autenticar, apenasAdmin, async (req, res) => {
    const { email, senha, nome, papel } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        const { rows } = await pool.query(
            `INSERT INTO bot_usuario (email, senha_hash, nome, papel)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, nome, papel, ativo, criado_em`,
            [email, senhaHash, nome || '', papel || 'admin']
        );
        res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }
        res.status(500).json({ erro: err.message });
    }
});

router.put('/usuarios/:id', autenticar, apenasAdmin, async (req, res) => {
    const { nome, email, papel, ativo, senha } = req.body;
    const id = parseInt(req.params.id);

    try {
        if (senha) {
            const senhaHash = await bcrypt.hash(senha, 10);
            await pool.query(
                `UPDATE bot_usuario SET nome=$1, email=$2, papel=$3, ativo=$4, senha_hash=$5, atualizado_em=NOW() WHERE id=$6`,
                [nome, email, papel, ativo, senhaHash, id]
            );
        } else {
            await pool.query(
                `UPDATE bot_usuario SET nome=$1, email=$2, papel=$3, ativo=$4, atualizado_em=NOW() WHERE id=$5`,
                [nome, email, papel, ativo, id]
            );
        }

        const { rows } = await pool.query(
            `SELECT id, email, nome, papel, ativo, criado_em, atualizado_em FROM bot_usuario WHERE id=$1`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }
        res.status(500).json({ erro: err.message });
    }
});

router.delete('/usuarios/:id', autenticar, apenasAdmin, async (req, res) => {
    const id = parseInt(req.params.id);

    if (id === req.usuario.id) {
        return res.status(400).json({ erro: 'Você não pode excluir sua própria conta' });
    }

    try {
        const { rowCount } = await pool.query(`DELETE FROM bot_usuario WHERE id=$1`, [id]);
        if (rowCount === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

export default router;
