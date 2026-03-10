"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotService = void 0;
const common_1 = require("@nestjs/common");
const wppconnect = __importStar(require("@wppconnect-team/wppconnect"));
const conversation_service_1 = require("../conversation/conversation.service");
const state_machine_engine_1 = require("./state-machine.engine");
const handler_service_1 = require("./handler.service");
let BotService = BotService_1 = class BotService {
    engine;
    handler;
    conversationService;
    logger = new common_1.Logger(BotService_1.name);
    client = null;
    sessao;
    iniciadoEm = 0;
    constructor(engine, handler, conversationService) {
        this.engine = engine;
        this.handler = handler;
        this.conversationService = conversationService;
        this.sessao = process.env.BOT_SESSAO || 'sessao-bot-wpp';
    }
    async onModuleInit() {
        this.iniciar().catch((err) => {
            this.logger.error(`Falha ao iniciar o bot: ${err.message}`);
        });
    }
    async onModuleDestroy() {
        if (this.client) {
            try {
                await this.client.close();
                this.logger.log('Navegador do WPPConnect fechado.');
            }
            catch (err) {
                this.logger.error(`Erro ao fechar WPPConnect: ${err.message}`);
            }
        }
    }
    async iniciar() {
        this.iniciadoEm = Math.floor(Date.now() / 1000);
        this.logger.log(`Iniciando sessão WPPConnect: ${this.sessao}`);
        try {
            this.client = await wppconnect.create({
                session: this.sessao,
                logQR: true,
                autoClose: 0,
                catchQR: (base64Qr, asciiQR) => {
                    this.logger.log('Escaneie o QR Code para conectar');
                    console.log(asciiQR);
                },
                headless: true,
                browserArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            });
            this.handler.client = this.client;
            await this.aoConectar();
        }
        catch (error) {
            this.logger.error(`Erro ao iniciar WPPConnect: ${error.message}`);
        }
    }
    async aoConectar() {
        this.logger.log('Conexão estabelecida! Aguardando sincronização...');
        await this.aguardar(3000);
        await this.enviarMensagemDeInicializacao();
        this.ouvirMensagens();
    }
    async enviarMensagemDeInicializacao() {
        const numero = process.env.BOT_NUMERO_ADMIN || '5514998089672@c.us';
        const texto = '🚀 Bot online e operante via NestJS + WPPConnect!';
        try {
            await this.client.sendText(numero.includes('@') ? numero : `${numero}@c.us`, texto);
            this.logger.log('Mensagem de inicialização enviada.');
        }
        catch (err) {
            this.logger.error(`Erro ao enviar mensagem de inicialização: ${err.message}`);
        }
    }
    ouvirMensagens() {
        this.client.onMessage(async (message) => {
            if (!message || message.isGroupMsg || message.from === 'status@broadcast' || message.id?.remote === 'status@broadcast') {
                return;
            }
            if (message.fromMe)
                return;
            const timestampMsg = message.timestamp ?? message.t ?? 0;
            if (timestampMsg > 0 && timestampMsg < this.iniciadoEm)
                return;
            if (process.env.BOT_MODO_TESTE === 'true') {
                const numeroAdmin = (process.env.BOT_NUMERO_ADMIN || '').replace(/\D/g, '');
                const lidAdmin = (process.env.BOT_LID_ADMIN || '').replace(/\D/g, '');
                const numeroRemetente = (message.from || '').split('@')[0].replace(/\D/g, '');
                const isAdmin = numeroRemetente === numeroAdmin || (lidAdmin && numeroRemetente === lidAdmin);
                if (!isAdmin)
                    return;
            }
            this.logger.log(`Mensagem de ${message.from} [${message.type}]: ${message.body ?? ''}`);
            try {
                await this.salvarNoBanco(message);
                await this.processarMensagem(message);
            }
            catch (err) {
                this.logger.error(`Erro ao processar mensagem de ${message.from}: ${err.message}`);
            }
        });
    }
    async processarMensagem(message) {
        const chatId = message.chatId || message.from;
        const nome = message.sender?.pushname || message.sender?.name || null;
        let corpo;
        if (message.type === 'list_response') {
            corpo = (message.selectedRowId || '').trim().toLowerCase();
        }
        else if (message.type === 'buttons_response') {
            corpo = (message.selectedButtonId || '').trim().toLowerCase();
        }
        else {
            corpo = (message.body || message.content || '').trim().toLowerCase();
        }
        await this.engine.process(message, chatId, corpo, nome, this.handler);
    }
    async salvarNoBanco(message) {
        const nome = message.sender?.pushname || message.sender?.name || null;
        const quemEnviou = this.extrairNumero(message.from);
        const paraQuem = this.extrairNumero(message.to);
        try {
            await this.conversationService.salvarMensagem(nome, message, quemEnviou, paraQuem, message.body || message.content || '');
        }
        catch (err) {
            this.logger.error(`Falha ao salvar mensagem: ${err.message}`);
        }
    }
    extrairNumero(jid) {
        if (!jid)
            return null;
        return jid.split('@')[0].substring(0, 20);
    }
    aguardar(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.BotService = BotService;
exports.BotService = BotService = BotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [state_machine_engine_1.StateMachineEngine,
        handler_service_1.HandlerService,
        conversation_service_1.ConversationService])
], BotService);
//# sourceMappingURL=bot.service.js.map