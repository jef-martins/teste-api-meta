require('dotenv').config();

const AppServer = require('./src/server');
const Handler = require('./src/bot/Handler');

// ─── Servidor Express ────────────────────────────────────────────────────────
const servidor = new AppServer();
servidor.iniciar();

// ─── Bot WhatsApp ────────────────────────────────────────────────────────────
const bot = new Handler('sessao-bot-wpp');

bot.iniciar().catch((err) => {
    console.error('[App] Erro fatal ao iniciar o bot:', err);
    process.exit(1);
});
