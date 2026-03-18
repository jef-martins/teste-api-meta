import { PrismaService } from '../prisma/prisma.service';
export declare class EstadoRepository {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    obterConfigEstado(estado: string): Promise<{
        handler: string;
        descricao: string | null;
        config: any;
    } | null>;
    buscarProximoEstado(estadoAtual: string, entrada: string): Promise<string | null>;
    obterEstadoUsuario(chatId: string): Promise<string | null>;
    salvarEstadoUsuario(chatId: string, estado: string, nome?: string | null): Promise<void>;
    registrarTransicao(chatId: string, estadoAnterior: string, estadoNovo: string, mensagemGatilho?: string | null): Promise<void>;
    obterEstadoInicial(): Promise<string>;
}
