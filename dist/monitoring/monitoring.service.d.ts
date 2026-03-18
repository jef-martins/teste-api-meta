import { PrismaService } from '../prisma/prisma.service';
export declare class MonitoringService {
    private prisma;
    constructor(prisma: PrismaService);
    listarSessoes(): Promise<unknown>;
    detalhesSessao(chatId: string): Promise<{
        usuario: {
            criadoEm: Date;
            nome: string | null;
            atualizadoEm: Date;
            chatId: string;
            contexto: import("@prisma/client/runtime/library").JsonValue;
            estadoAtual: string;
        };
        historico: {
            id: string;
            criadoEm: Date;
            config: import("@prisma/client/runtime/library").JsonValue;
            chatId: string;
            estadoAnterior: string;
            estadoNovo: string;
            mensagemGatilho: string | null;
        }[];
        mensagens: {
            id: string;
            criadoEm: Date;
            nome: string | null;
            dados: import("@prisma/client/runtime/library").JsonValue | null;
            quemEnviou: string | null;
            paraQuem: string | null;
            mensagem: string | null;
        }[];
    }>;
    historico(chatId: string): Promise<{
        id: string;
        criadoEm: Date;
        config: import("@prisma/client/runtime/library").JsonValue;
        chatId: string;
        estadoAnterior: string;
        estadoNovo: string;
        mensagemGatilho: string | null;
    }[]>;
    dashboard(): Promise<{
        totalSessoes: number;
        sessoesHoje: number;
        totalMensagens: number;
        mensagensHoje: number;
        transicoesHoje: number;
        totalFluxos: number;
        fluxoAtivo: {
            id: string;
            nome: string;
        } | null;
        estadosMaisUsados: unknown;
        mensagensPorDia: unknown;
    }>;
}
