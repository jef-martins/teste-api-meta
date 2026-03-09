import { AdminService } from './admin.service';
export declare class AdminController {
    private adminService;
    constructor(adminService: AdminService);
    listarEstados(): Promise<{
        ativo: boolean;
        handler: string;
        config: import("@prisma/client/runtime/library").JsonValue;
        descricao: string | null;
        estado: string;
    }[]>;
    criarEstado(body: any): Promise<{
        criadoEm: Date;
        ativo: boolean;
        handler: string;
        config: import("@prisma/client/runtime/library").JsonValue;
        descricao: string | null;
        estado: string;
        nodeId: string | null;
        nodeType: string | null;
        position: import("@prisma/client/runtime/library").JsonValue | null;
        flowId: number | null;
    }>;
    atualizarEstado(estado: string, body: any): Promise<{
        criadoEm: Date;
        ativo: boolean;
        handler: string;
        config: import("@prisma/client/runtime/library").JsonValue;
        descricao: string | null;
        estado: string;
        nodeId: string | null;
        nodeType: string | null;
        position: import("@prisma/client/runtime/library").JsonValue | null;
        flowId: number | null;
    }>;
    excluirEstado(estado: string): Promise<{
        ok: boolean;
    }>;
    listarTransicoes(): Promise<{
        id: number;
        ativo: boolean;
        estadoOrigem: string;
        entrada: string;
        estadoDestino: string;
    }[]>;
    criarTransicao(body: any): Promise<{
        id: number;
        criadoEm: Date;
        ativo: boolean;
        estadoOrigem: string;
        entrada: string;
        estadoDestino: string;
    }>;
    atualizarTransicao(id: number, body: any): Promise<{
        id: number;
        criadoEm: Date;
        ativo: boolean;
        estadoOrigem: string;
        entrada: string;
        estadoDestino: string;
    }>;
    excluirTransicao(id: number): Promise<{
        ok: boolean;
    }>;
    testarRequisicao(body: any): Promise<{
        status: number;
        data: string;
        erro?: undefined;
    } | {
        status: number;
        erro: any;
        data?: undefined;
    }>;
}
