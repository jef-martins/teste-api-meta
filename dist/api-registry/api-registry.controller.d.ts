import { ApiRegistryService } from './api-registry.service';
export declare class ApiRegistryController {
    private service;
    constructor(service: ApiRegistryService);
    private getSubOrgId;
    private getOrgId;
    listar(req: any, headers: Record<string, string>): Promise<{
        tokenSubOrg: {
            id: number;
            criadoEm: Date;
            atualizadoEm: Date;
            subOrganizacaoId: number;
            headers: import("@prisma/client/runtime/library").JsonValue;
            apiId: number;
            token: string;
        } | null;
        subOrgTokens: undefined;
        rotas: {
            id: number;
            criadoEm: Date;
            descricao: string | null;
            apiId: number;
            path: string;
            metodo: string;
            parametros: import("@prisma/client/runtime/library").JsonValue;
            bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        id: number;
        organizacaoId: number;
        criadoEm: Date;
        nome: string;
        atualizadoEm: Date;
        headers: import("@prisma/client/runtime/library").JsonValue;
        urlBase: string;
    }[]>;
    criar(req: any, headers: Record<string, string>, body: {
        nome: string;
        urlBase: string;
        headers?: object;
    }): Promise<{
        rotas: {
            id: number;
            criadoEm: Date;
            descricao: string | null;
            apiId: number;
            path: string;
            metodo: string;
            parametros: import("@prisma/client/runtime/library").JsonValue;
            bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: number;
        organizacaoId: number;
        criadoEm: Date;
        nome: string;
        atualizadoEm: Date;
        headers: import("@prisma/client/runtime/library").JsonValue;
        urlBase: string;
    }>;
    atualizar(id: number, req: any, body: {
        nome?: string;
        urlBase?: string;
        headers?: object;
    }): Promise<{
        rotas: {
            id: number;
            criadoEm: Date;
            descricao: string | null;
            apiId: number;
            path: string;
            metodo: string;
            parametros: import("@prisma/client/runtime/library").JsonValue;
            bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: number;
        organizacaoId: number;
        criadoEm: Date;
        nome: string;
        atualizadoEm: Date;
        headers: import("@prisma/client/runtime/library").JsonValue;
        urlBase: string;
    }>;
    excluir(id: number, req: any): Promise<{
        ok: boolean;
    }>;
    salvarToken(apiId: number, headers: Record<string, string>, req: any, body: {
        token: string;
        headers?: object;
    }): Promise<{
        id: number;
        criadoEm: Date;
        atualizadoEm: Date;
        subOrganizacaoId: number;
        headers: import("@prisma/client/runtime/library").JsonValue;
        apiId: number;
        token: string;
    }>;
    removerToken(apiId: number, headers: Record<string, string>, req: any): Promise<{
        ok: boolean;
    }>;
    listarRotas(apiId: number, req: any): Promise<{
        id: number;
        criadoEm: Date;
        descricao: string | null;
        apiId: number;
        path: string;
        metodo: string;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    criarRota(apiId: number, req: any, body: {
        path: string;
        metodo?: string;
        descricao?: string;
        parametros?: object[];
        bodyTemplate?: object;
    }): Promise<{
        id: number;
        criadoEm: Date;
        descricao: string | null;
        apiId: number;
        path: string;
        metodo: string;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    atualizarRota(apiId: number, rotaId: number, req: any, body: {
        path?: string;
        metodo?: string;
        descricao?: string;
        parametros?: object[];
        bodyTemplate?: object;
    }): Promise<{
        id: number;
        criadoEm: Date;
        descricao: string | null;
        apiId: number;
        path: string;
        metodo: string;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    excluirRota(apiId: number, rotaId: number, req: any): Promise<{
        ok: boolean;
    }>;
}
