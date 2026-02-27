const BotWhatsApp      = require('./BotWhatsApp');
const estadoRepository = require('../database/estadoRepository');

// Estado padrão caso não exista nada no banco para o usuário
const ESTADO_PADRAO = 'NOVO';

// ─────────────────────────────────────────────────────────────────────────────
// Classe principal
// ─────────────────────────────────────────────────────────────────────────────

class Bot extends BotWhatsApp {
    constructor(sessao = 'sessao-bot-wpp') {
        super(sessao);

        /** @type {Map<string, string>} chatId → estado atual (cache local) */
        this.estadosUsuarios = new Map();

        /** @type {Map<string, object>} chatId → dados capturados em memória { campo: valor } */
        this.dadosCapturados = new Map();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inicialização — carrega config do banco antes de ouvir mensagens
    // ─────────────────────────────────────────────────────────────────────────

    async iniciar() {
        console.log('[Bot] Carregando configurações de estados do banco...');
        await estadoRepository.carregarConfiguracoes();
        console.log('[Bot] Configurações carregadas. Iniciando bot...');

        // Chama o iniciar() da classe pai (BotWhatsApp) que cria a sessão WPP
        await super.iniciar();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Utilitários genéricos
    // ─────────────────────────────────────────────────────────────────────────

    _interpolar(texto, variaveis = {}) {
        return texto.replace(/\{(\w+)\}/g, (_, chave) => variaveis[chave] ?? `{${chave}}`);
    }

    _extrairValorPath(obj, path) {
        if (!path) return obj;
        return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? '';
    }

    /**
     * Salva um valor capturado para um chatId.
     * @param {string} chatId
     * @param {string} campo   - nome do campo (ex: 'nome', 'cpf')
     * @param {string} valor
     */
    _salvarDado(chatId, campo, valor) {
        const atual = this.dadosCapturados.get(chatId) ?? {};
        this.dadosCapturados.set(chatId, { ...atual, [campo]: valor });
    }

    /**
     * Retorna todos os dados capturados para um chatId.
     * @param {string} chatId
     * @returns {object}
     */
    _obterDados(chatId) {
        return this.dadosCapturados.get(chatId) ?? {};
    }

    /**
     * Limpa os dados capturados de um chatId.
     * @param {string} chatId
     */
    _limparDados(chatId) {
        this.dadosCapturados.delete(chatId);
    }



    // ─────────────────────────────────────────────────────────────────────────
    // Roteador principal — totalmente controlado pelo banco
    // ─────────────────────────────────────────────────────────────────────────

    async _processarMensagem(message) {
        const chatId = message.chatId || message.from;
        const nome   = message.sender?.pushname || message.sender?.name || null;

        // ── Extrai a entrada correta conforme o tipo de mensagem ──────────────
        // list_response   → usuário selecionou item da lista   → selectedRowId
        // buttons_response→ usuário clicou em botão interativo → selectedButtonId
        // text / outros   → mensagem de texto normal           → body
        let corpo;
        if (message.type === 'list_response') {
            corpo = (message.selectedRowId || '').trim().toLowerCase();
        } else if (message.type === 'buttons_response') {
            corpo = (message.selectedButtonId || '').trim().toLowerCase();
        } else {
            corpo = (message.body || message.content || '').trim().toLowerCase();
        }

        // ── Carrega/Atualiza sempre o estado do banco (permite alteração manual no DB) ──
        const estadoSalvo = await estadoRepository.obterEstadoUsuario(chatId);
        this.estadosUsuarios.set(chatId, estadoSalvo ?? ESTADO_PADRAO);
        
        if (estadoSalvo && !this._estadosAvisados?.has(chatId)) {
            console.log(`[Bot] [${chatId}] estado restaurado do banco: ${estadoSalvo}`);
            this._estadosAvisados = this._estadosAvisados || new Set();
            this._estadosAvisados.add(chatId);
        }

        const estadoAtual = this.estadosUsuarios.get(chatId);

        // ── Busca o handler deste estado no banco (query direta) ──
        const config = await estadoRepository.obterConfigEstado(estadoAtual);

        if (!config) {
            console.warn(`[Bot] Estado "${estadoAtual}" não encontrado no banco. Reiniciando para ${ESTADO_PADRAO}.`);
            await this._avancarEstado(chatId, ESTADO_PADRAO, corpo, nome);
            return;
        }

        console.log(`[Bot] [${chatId}] estado=${estadoAtual} → handler=${config.handler}`);

        // Guarda contexto da mensagem atual para uso interno nos handlers
        this._mensagemAtual = corpo;
        this._nomeAtual     = nome;

        // ── Flag aguardarEntrada ──────────────────────────────────────────────
        // Quando o estado tem aguardarEntrada: true no config, ele NÃO re-executa
        // o handler ao receber uma nova mensagem. Em vez disso, busca a transição
        // diretamente e avança de estado. Ideal para estados terminais como ENCERRADO.
        if (config.config?.aguardarEntrada && corpo) {
            console.log(`[Bot] [${chatId}] estado aguarda entrada → buscando transição para "${corpo}"`);
            await this._transitarPorEntrada(chatId, estadoAtual, corpo, message, true);
            return;
        }

        // Executa o handler correspondente
        if (typeof this[config.handler] === 'function') {
            await this[config.handler](message, chatId, corpo);
        } else {
            console.error(`[Bot] Handler "${config.handler}" não existe na classe!`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transição de estado — consulta o banco para saber o próximo
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Busca no banco qual é o próximo estado para (estadoAtual + entrada),
     * atualiza memória + banco + histórico.
     *
     * @param {string}      chatId
     * @param {string}      proximo    - próximo estado (se já souber) ou null para buscar no banco
     * @param {string|null} gatilho    - texto que causou a transição
     * @param {string|null} nome       - nome do contato
     */
    async _avancarEstado(chatId, proximo, gatilho = null, nome = null) {
        const anterior = this.estadosUsuarios.get(chatId) ?? ESTADO_PADRAO;

        // Atualiza memória
        this.estadosUsuarios.set(chatId, proximo);

        console.log(`[Bot] [${chatId}] transição: ${anterior} → ${proximo}`);

        // Persiste no banco (fire-and-forget, sem bloquear o fluxo)
        estadoRepository.salvarEstadoUsuario(chatId, proximo, nome ?? this._nomeAtual).catch(() => {});
        estadoRepository.registrarTransicao(chatId, anterior, proximo, gatilho ?? this._mensagemAtual).catch(() => {});
    }

    /**
     * Busca o próximo estado no banco pela entrada do usuário e transiciona.
     * Se encontrar, avança e opcionalmente executa o handler do novo estado.
     *
     * @param {string}  chatId
     * @param {string}  estadoAtual
     * @param {string}  entrada        - texto enviado pelo usuário
     * @param {object}  message        - objeto original da mensagem
     * @param {boolean} executarHandler - se true, chama o handler do próximo estado com corpo vazio
     * @returns {string|null} o próximo estado, ou null se não encontrou transição
     */
    async _transitarPorEntrada(chatId, estadoAtual, entrada, message, executarHandler = true) {
        const proximo = await estadoRepository.buscarProximoEstado(estadoAtual, entrada);

        if (!proximo) return null;

        await this._avancarEstado(chatId, proximo, this._mensagemAtual);

        // Executa o handler do novo estado com corpo vazio (exibe a mensagem de entrada)
        if (executarHandler) {
            const configProximo = await estadoRepository.obterConfigEstado(proximo);
            if (configProximo && typeof this[configProximo.handler] === 'function') {
                await this[configProximo.handler](message, chatId, '');
            }
        }

        return proximo;
    }
}

module.exports = Bot;
