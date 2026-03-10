import { PrismaService } from '../prisma/prisma.service';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    listarEstados(): Promise<{
        ativo: boolean;
        handler: string;
        config: import("@prisma/client/runtime/library").JsonValue;
        descricao: string | null;
        estado: string;
    }[]>;
    criarEstado(data: {
        estado: string;
        handler: string;
        descricao?: string;
        config?: any;
    }): Promise<{
        criadoEm: Date;
        ativo: boolean;
        handler: string;
        config: import("@prisma/client/runtime/library").JsonValue;
        descricao: string | null;
        estado: string;
        nodeId: string | null;
        nodeType: string | null;
        position: import("@prisma/client/runtime/library").JsonValue | null;
        flowId: string | null;
    }>;
    atualizarEstado(estado: string, data: {
        handler: string;
        descricao?: string;
        config?: any;
        ativo?: boolean;
    }): Promise<{
        criadoEm: Date;
        ativo: boolean;
        handler: string;
        config: import("@prisma/client/runtime/library").JsonValue;
        descricao: string | null;
        estado: string;
        nodeId: string | null;
        nodeType: string | null;
        position: import("@prisma/client/runtime/library").JsonValue | null;
        flowId: string | null;
    }>;
    excluirEstado(estado: string): Promise<{
        ok: boolean;
    }>;
    listarTransicoes(): Promise<{
        id: string;
        ativo: boolean;
        estadoOrigem: string;
        entrada: string;
        estadoDestino: string;
    }[]>;
    criarTransicao(data: {
        estado_origem: string;
        entrada: string;
        estado_destino: string;
    }): Promise<{
        id: string;
        criadoEm: Date;
        ativo: boolean;
        estadoOrigem: string;
        entrada: string;
        estadoDestino: string;
    }>;
    atualizarTransicao(id: string, data: {
        estado_origem: string;
        entrada: string;
        estado_destino: string;
        ativo?: boolean;
    }): Promise<{
        id: string;
        criadoEm: Date;
        ativo: boolean;
        estadoOrigem: string;
        entrada: string;
        estadoDestino: string;
    }>;
    excluirTransicao(id: string): Promise<{
        ok: boolean;
    }>;
    testarRequisicao(data: {
        config: any;
        valor?: string;
        variaveis?: Record<string, string>;
    }): Promise<{
        status: number;
        data: string;
        erro?: undefined;
    } | {
        status: number;
        erro: any;
        data?: undefined;
    }>;
}
