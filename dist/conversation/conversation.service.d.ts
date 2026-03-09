import { PrismaService } from '../prisma/prisma.service';
export declare class ConversationService {
    private prisma;
    constructor(prisma: PrismaService);
    listar(): Promise<{
        id: number;
        criadoEm: Date;
        nome: string | null;
        dados: import("@prisma/client/runtime/library").JsonValue | null;
        quemEnviou: string | null;
        paraQuem: string | null;
        mensagem: string | null;
    }[]>;
    salvarMensagem(nome: string | null, dados: any, quemEnviou: string | null, paraQuem: string | null, mensagem: string | null): Promise<{
        id: number;
        criadoEm: Date;
        nome: string | null;
        dados: import("@prisma/client/runtime/library").JsonValue | null;
        quemEnviou: string | null;
        paraQuem: string | null;
        mensagem: string | null;
    }>;
}
