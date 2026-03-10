import { ApiRegistryService } from './api-registry.service';
export declare class ApiRegistryController {
    private service;
    constructor(service: ApiRegistryService);
    private getSubOrgId;
    private getOrgId;
    listar(req: any, headers: Record<string, string>): Promise<{
        tokenSubOrg: {
            id: string;
            criadoEm: Date;
            atualizadoEm: Date;
            subOrganizacaoId: string;
            headers: import("@prisma/client/runtime/library").JsonValue;
            apiId: string;
            token: string;
        } | null;
        subOrgTokens: undefined;
        rotas: {
            id: string;
            criadoEm: Date;
            descricao: string | null;
            apiId: string;
            path: string;
            metodo: string;
            parametros: import("@prisma/client/runtime/library").JsonValue;
            bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        id: string;
        organizacaoId: string;
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
            id: string;
            criadoEm: Date;
            descricao: string | null;
            apiId: string;
            path: string;
            metodo: string;
            parametros: import("@prisma/client/runtime/library").JsonValue;
            bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: string;
        organizacaoId: string;
        criadoEm: Date;
        nome: string;
        atualizadoEm: Date;
        headers: import("@prisma/client/runtime/library").JsonValue;
        urlBase: string;
    }>;
    atualizar(id: string, req: any, body: {
        nome?: string;
        urlBase?: string;
        headers?: object;
    }): Promise<{
        rotas: {
            id: string;
            criadoEm: Date;
            descricao: string | null;
            apiId: string;
            path: string;
            metodo: string;
            parametros: import("@prisma/client/runtime/library").JsonValue;
            bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: string;
        organizacaoId: string;
        criadoEm: Date;
        nome: string;
        atualizadoEm: Date;
        headers: import("@prisma/client/runtime/library").JsonValue;
        urlBase: string;
    }>;
    excluir(id: string, req: any): Promise<{
        ok: boolean;
    }>;
    salvarToken(apiId: string, headers: Record<string, string>, req: any, body: {
        token: string;
        headers?: object;
    }): Promise<{
        id: string;
        criadoEm: Date;
        atualizadoEm: Date;
        subOrganizacaoId: string;
        headers: import("@prisma/client/runtime/library").JsonValue;
        apiId: string;
        token: string;
    }>;
    removerToken(apiId: string, headers: Record<string, string>, req: any): Promise<{
        ok: boolean;
    }>;
    listarRotas(apiId: string, req: any): Promise<{
        id: string;
        criadoEm: Date;
        descricao: string | null;
        apiId: string;
        path: string;
        metodo: string;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    criarRota(apiId: string, req: any, body: {
        path: string;
        metodo?: string;
        descricao?: string;
        parametros?: object[];
        bodyTemplate?: object;
    }): Promise<{
        id: string;
        criadoEm: Date;
        descricao: string | null;
        apiId: string;
        path: string;
        metodo: string;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    atualizarRota(apiId: string, rotaId: string, req: any, body: {
        path?: string;
        metodo?: string;
        descricao?: string;
        parametros?: object[];
        bodyTemplate?: object;
    }): Promise<{
        id: string;
        criadoEm: Date;
        descricao: string | null;
        apiId: string;
        path: string;
        metodo: string;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    excluirRota(apiId: string, rotaId: string, req: any): Promise<{
        ok: boolean;
    }>;
}
