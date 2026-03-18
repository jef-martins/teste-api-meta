"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'seu_banco',
    user: process.env.DB_USER || 'seu_usuario',
    password: process.env.DB_PASSWORD || 'sua_senha',
});
pool.on('connect', () => {
    console.log('[DB] Conectado ao PostgreSQL com sucesso.');
});
pool.on('error', (err) => {
    console.error('[DB] Erro inesperado no pool de conexão:', err);
});
exports.default = pool;
//# sourceMappingURL=db.js.map