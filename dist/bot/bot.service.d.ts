import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConversationService } from '../conversation/conversation.service';
import { StateMachineEngine } from './state-machine.engine';
import { HandlerService } from './handler.service';
export declare class BotService implements OnModuleInit, OnModuleDestroy {
    private engine;
    private handler;
    private conversationService;
    private readonly logger;
    private client;
    private sessao;
    private iniciadoEm;
    constructor(engine: StateMachineEngine, handler: HandlerService, conversationService: ConversationService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    iniciar(): Promise<void>;
    private aoConectar;
    private enviarMensagemDeInicializacao;
    private ouvirMensagens;
    private processarMensagem;
    private salvarNoBanco;
    private extrairNumero;
    private aguardar;
}
