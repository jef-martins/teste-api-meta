import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'telebots-dev-secret-change-in-production';

export function autenticar(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token não fornecido' });
    }

    try {
        const token = header.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        req.usuario = payload;
        next();
    } catch (err) {
        return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
}

export function gerarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, email: usuario.email, papel: usuario.papel },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

export function apenasAdmin(req, res, next) {
    if (req.usuario?.papel !== 'admin') {
        return res.status(403).json({ erro: 'Acesso restrito a administradores' });
    }
    next();
}

export const jwtSecret = JWT_SECRET;
