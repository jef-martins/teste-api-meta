import 'dotenv/config';

import AppServer from './src/server';
import Handler from './src/bot/Handler';

// ─── Servidor Express ────────────────────────────────────────────────────────
const servidor = new AppServer();
servidor.iniciar();

// ─── Bot WhatsApp ────────────────────────────────────────────────────────────
const bot = new Handler('sessao-bot-wpp');

bot.iniciar().catch((err) => {
    console.error('[App] Erro fatal ao iniciar o bot:', err);
    process.exit(1);
});

// ─── Desligamento Seguro (Graceful Shutdown) ─────────────────────────────────
async function encerrarBot() {
    console.log('\n[App] Sinal de encerramento recebido. Desligando o bot com segurança...');
    try {
        if (bot && bot.client) {
            await bot.client.close();
            console.log('[App] Navegador do WPPConnect fechado.');
        }
        process.exit(0);
    } catch (err) {
        console.error('[App] Erro ao desligar o WPPConnect:', err);
        process.exit(1);
    }
}

// Escuta os sinais de Ctrl+C e paradas do sistema
process.on('SIGINT', encerrarBot);
process.on('SIGTERM', encerrarBot);