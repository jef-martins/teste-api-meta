import { ConversationService } from './conversation.service';
export declare class ConversationController {
    private conversationService;
    constructor(conversationService: ConversationService);
    listar(): Promise<{
        id: number;
        criadoEm: Date;
        nome: string | null;
        dados: import("@prisma/client/runtime/library").JsonValue | null;
        quemEnviou: string | null;
        paraQuem: string | null;
        mensagem: string | null;
    }[]>;
}
