import BotWhatsApp from './BotWhatsApp';
import estadoRepository from '../database/estadoRepository';
import StateMachineEngine from './StateMachineEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Classe principal apenas para Infra e Recepção de Payload
// ─────────────────────────────────────────────────────────────────────────────

class Bot extends BotWhatsApp {
    public engine: StateMachineEngine;

    constructor(sessao = 'sessao-bot-wpp') {
        super(sessao);

        // Instancia o novo motor de estados injetando esta classe como delegate 
        // para executar os "handlers" de Handler.js depois
        this.engine = new StateMachineEngine(this);
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
    // Recepção Principal e Delegação
    // ─────────────────────────────────────────────────────────────────────────

    async _processarMensagem(message) {
        const chatId = message.chatId || message.from;
        const nome   = message.sender?.pushname || message.sender?.name || null;

        // ── Extrai a entrada correta conforme o tipo de mensagem ──────────────
        let corpo;
        if (message.type === 'list_response') {
            corpo = (message.selectedRowId || '').trim().toLowerCase();
        } else if (message.type === 'buttons_response') {
            corpo = (message.selectedButtonId || '').trim().toLowerCase();
        } else {
            corpo = (message.body || message.content || '').trim().toLowerCase();
        }

        // ── Entrega a responsabilidade de orquestração para a Engine ──────────
        await this.engine.process(message, chatId, corpo, nome);
    }
}

export default Bot;
