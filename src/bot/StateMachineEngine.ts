import estadoRepository from '../database/estadoRepository';
import pool from '../database/db';

const ESTADO_PADRAO_FALLBACK = 'NOVO';

class StateMachineEngine {
    public estadosUsuarios = new Map<string, string>();
    public dadosCapturados = new Map<string, object>();
    public actionDelegate: any;
    public mensagemAtual?: string;
    public nomeAtual?: string | null;
    public _estadosAvisados?: Set<string>;

    constructor(actionDelegate) {


        // Referência à classe que possui de fato as implementações (ex: _handlerMensagem)
        this.actionDelegate = actionDelegate;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Utilitários genéricos
    // ─────────────────────────────────────────────────────────────────────────

    interpolar(texto, variaveis = {}) {
        return texto.replace(/\{(\w+)\}/g, (_, chave) => variaveis[chave] ?? `{${chave}}`);
    }

    extrairValorPath(obj, path) {
        if (!path) return obj;
        return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? '';
    }

    salvarDado(chatId, campo, valor) {
        const atual = this.dadosCapturados.get(chatId) ?? {};
        this.dadosCapturados.set(chatId, { ...atual, [campo]: valor });
    }

    obterDados(chatId) {
        return this.dadosCapturados.get(chatId) ?? {};
    }

    limparDados(chatId) {
        this.dadosCapturados.delete(chatId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Motor de Execução
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Obtém o estado inicial do fluxo ativo (nó do tipo 'start').
     * Faz fallback para ESTADO_PADRAO_FALLBACK se não encontrar.
     */
    async _obterEstadoInicial() {
        try {
            const res = await pool.query(
                `SELECT e.estado FROM bot_estado_config e
                 INNER JOIN bot_fluxo f ON e.flow_id = f.id
                 WHERE f.ativo = true AND e.node_type = 'start' AND e.ativo = true
                 LIMIT 1`
            );
            return res.rows[0]?.estado || ESTADO_PADRAO_FALLBACK;
        } catch {
            return ESTADO_PADRAO_FALLBACK;
        }
    }

    async process(message: any, chatId: string, entrada: string | undefined, nome: string | null = null) {
        // ── Carrega/Atualiza sempre o estado do banco (permite alteração manual no DB) ──
        const estadoSalvo = await estadoRepository.obterEstadoUsuario(chatId);
        const estadoPadrao = await this._obterEstadoInicial();
        this.estadosUsuarios.set(chatId, estadoSalvo ?? estadoPadrao);

        if (estadoSalvo && !this._estadosAvisados?.has(chatId)) {
            console.log(`[Engine] [${chatId}] estado restaurado do banco: ${estadoSalvo}`);
            this._estadosAvisados = this._estadosAvisados || new Set();
            this._estadosAvisados.add(chatId);
        }

        const estadoAtual = this.estadosUsuarios.get(chatId);

        // ── Busca o handler deste estado no banco (query direta) ──
        const config = await estadoRepository.obterConfigEstado(estadoAtual);

        if (!config) {
            console.warn(`[Engine] Estado "${estadoAtual}" não encontrado/ativo no banco. Reiniciando para ${estadoPadrao}.`);
            await this.avancarEstado(chatId, estadoPadrao, entrada ?? null, nome);
            return;
        }

        console.log(`[Engine] [${chatId}] estado=${estadoAtual} → handler=${config.handler}`);

        // Guarda contexto da mensagem atual para uso interno caso o Handler queira resgatar
        this.mensagemAtual = entrada;
        this.nomeAtual     = nome;

        // ── Flag aguardarEntrada ──────────────────────────────────────────────
        // Quando o estado tem aguardarEntrada: true no config, ele NÃO re-executa
        // o handler ao receber uma nova mensagem. Em vez disso, busca a transição
        // diretamente e avança de estado. Ideal para estados terminais como ENCERRADO.
        if (config.config?.aguardarEntrada && entrada) {
            console.log(`[Engine] [${chatId}] estado aguarda entrada → buscando transição para "${entrada}"`);
            await this.transitarPorEntrada(chatId, estadoAtual ?? '', entrada ?? '', message, true, nome);
            return;
        }

        // Executa o handler correspondente passando a instância do engine por último e os padrões
        if (typeof this.actionDelegate[config.handler] === 'function') {
            await this.actionDelegate[config.handler](message, chatId, entrada, this);
        } else {
            console.error(`[Engine] Handler "${config.handler}" não existe no Delegate (Bot)!`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transições Restritas da Engine
    // ─────────────────────────────────────────────────────────────────────────

    async avancarEstado(chatId: string, proximo: string, gatilho: string | null = null, nome: string | null = null) {
        const anterior = this.estadosUsuarios.get(chatId) ?? ESTADO_PADRAO_FALLBACK;

        // Atualiza memória
        this.estadosUsuarios.set(chatId, proximo);

        console.log(`[Engine] [${chatId}] transição: ${anterior} → ${proximo}`);

        // Persiste no banco (fire-and-forget, sem bloquear o fluxo)
        estadoRepository.salvarEstadoUsuario(chatId, proximo, nome ?? this.nomeAtual ?? '').catch(() => {});
        estadoRepository.registrarTransicao(chatId, anterior, proximo, gatilho ?? this.mensagemAtual ?? '').catch(() => {});
    }

    async transitarPorEntrada(chatId: string, estadoAtual: string, entrada: string, message: any, executarHandler: boolean = true, nome: string | null = null) {
        const proximo = await estadoRepository.buscarProximoEstado(estadoAtual, entrada);

        if (!proximo) return null;

        await this.avancarEstado(chatId, proximo, this.mensagemAtual ?? '', nome);

        // Executa o handler do novo estado com corpo vazio (exibe a mensagem de entrada)
        if (executarHandler) {
            const configProximo = await estadoRepository.obterConfigEstado(proximo);
            if (configProximo && typeof this.actionDelegate[configProximo.handler] === 'function') {
                await this.actionDelegate[configProximo.handler](message, chatId, '', this);
            }
        }

        return proximo;
    }
}

export default StateMachineEngine;
