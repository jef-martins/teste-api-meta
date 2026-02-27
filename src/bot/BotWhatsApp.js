const wppconnect = require('@wppconnect-team/wppconnect');
const conversaRepository = require('../database/conversaRepository');

class BotWhatsApp {
    constructor(sessao = 'sessao-bot-wpp') {
        this.sessao = sessao;
        this.client = null;
    }

    // ─────────────────────────────────────────────
    // Inicialização do bot
    // ─────────────────────────────────────────────

    async iniciar() {
        // Marca o momento exato de inicialização para ignorar mensagens antigas
        this._iniciadoEm = Math.floor(Date.now() / 1000);
        console.log(`[Bot] Iniciando sessão (WPPConnect): ${this.sessao}`);

        try {
            this.client = await wppconnect.create({
                session: this.sessao,
                logQR: true,
                autoClose: 0, // 0 = Nunca fechar automaticamente aguardando o QR
                catchQR: (base64Qr, asciiQR) => {
                    console.log('\n[Bot] ✨ Escaneie o QR Code para conectar ✨\n');
                    console.log(asciiQR); // AQUI: Imprime o QRCode no terminal!
                },
                headless: true,
                browserArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            await this._aoConectar();
        } catch (error) {
            console.error('[Bot] Erro ao iniciar o WPPConnect:', error);
        }
    }

    // ─────────────────────────────────────────────
    // Executado após conexão estabelecida
    // ─────────────────────────────────────────────

    async _aoConectar() {
        console.log('[Bot] Conexão estabelecida! Aguardando sincronização...');
        await this._aguardar(3000);

        await this._enviarMensagemDeInicializacao();
        this._ouvirMensagens();
    }

    // ─────────────────────────────────────────────
    // Mensagem enviada ao iniciar o bot
    // ─────────────────────────────────────────────

    async _enviarMensagemDeInicializacao() {
        const numero = process.env.BOT_NUMERO_ADMIN || '5514998089672@c.us';
        const texto = '🚀 Bot online e operante via WPPConnect!';

        try {
            await this.enviarMensagem(numero, texto);
            console.log('[Bot] Mensagem de inicialização enviada.');
        } catch (err) {
            console.error('[Bot] Erro ao enviar mensagem de inicialização:', err.message);
        }
    }

    // ─────────────────────────────────────────────
    // Escuta de mensagens recebidas
    // ─────────────────────────────────────────────

    _ouvirMensagens() {
        this.client.onMessage(async (message) => {
            if (!message || message.isGroupMsg) return; // Ignora grupos

            // Ignora mensagens enviadas pelo próprio bot
            if (message.fromMe) return;

            // Ignora mensagens antigas (anteriores ao momento de inicialização do bot)
            const timestampMsg = message.timestamp ?? message.t ?? 0;
            if (timestampMsg > 0 && timestampMsg < this._iniciadoEm) {
                console.log(`[Bot] ⏩ Mensagem antiga ignorada de ${message.from} (ts=${timestampMsg} < inicio=${this._iniciadoEm})`);
                return;
            }

            console.log(`[Bot] Mensagem recebida de ${message.from} [${message.type}]: ${message.body ?? ''}`);

            try {
                // Salva mensagem recebida no banco
                await this._salvarNoBanco(message);

                // Processa e responde
                await this._processarMensagem(message);
            } catch (err) {
                console.error(`[Bot] ❌ Erro ao processar mensagem de ${message.from}:`, err.message);
                console.error(err.stack);
            }
        });
    }

    /**
     * Método abstrato — deve ser implementado pela subclasse.
     * É chamado automaticamente a cada mensagem recebida.
     * @param {object} message
     */
    async _processarMensagem(message) {
        throw new Error(`[BotWhatsApp] _processarMensagem() não implementado na subclasse.`);
    }

    async enviarMensagem(numero, texto) {
        if (!this.client) throw new Error('[Bot] Client não inicializado.');

        try {
            const resultado = await this.client.sendText(numero, texto);
            console.log(`[Bot] Mensagem enviada para ${numero}.`);
            return resultado;
        } catch (err) {
            console.error(`[Bot] Falha no sendText para ${numero}:`, err.message || err);
            throw err;
        }
    }

    // ─────────────────────────────────────────────
    // Responde a uma mensagem recebida e salva no banco
    // ─────────────────────────────────────────────

    async enviarResposta(mensagemOriginal, textoResposta) {
        try {
            const destino = mensagemOriginal.from;

            const resultado = await this.client.sendText(destino, textoResposta);
            console.log(`[Bot] Resposta enviada para ${destino} via WPPConnect.`);

            const quemEnviou = this._extrairNumero(mensagemOriginal.to);
            const paraQuem = this._extrairNumero(destino);

            await conversaRepository.salvarMensagem('WPPConnect Bot', resultado, quemEnviou, paraQuem, textoResposta);
            console.log('[DB] Mensagem enviada salva no banco.');
        } catch (err) {
            console.error('[Bot] Erro ao enviar resposta:', err.message);
        }
    }

    // ─────────────────────────────────────────────
    // Salva mensagem recebida no banco
    // ─────────────────────────────────────────────

    async _salvarNoBanco(message) {
        const dados = message;
        const nome = message.sender?.pushname || message.sender?.name || null;
        const quemEnviou = this._extrairNumero(message.from);
        const paraQuem = this._extrairNumero(message.to);

        try {
            await conversaRepository.salvarMensagem(nome, dados, quemEnviou, paraQuem, message.body || message.content || '');
            console.log('[DB] Mensagem recebida salva no banco com sucesso.\n');
        } catch (err) {
            console.error('[DB] Falha ao salvar mensagem:', err.message);
        }
    }

    // ─────────────────────────────────────────────
    // Utilitários
    // ─────────────────────────────────────────────

    _aguardar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _extrairNumero(jid) {
        if (!jid) return null;

        const prefixo = jid.split('@')[0];

        return prefixo.substring(0, 20);
    }
}

module.exports = BotWhatsApp;
