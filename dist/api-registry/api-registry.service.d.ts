import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from '../organization/organization.service';
export declare class ApiRegistryService {
    private prisma;
    private orgService;
    constructor(prisma: PrismaService, orgService: OrganizationService);
    private getOrgIdFromSubOrg;
    private verificarMembroOrg;
    private verificarAcessoApi;
    listarApis(usuarioId: string, subOrgId: string | null): Promise<{
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
    criarApi(usuarioId: string, orgId: string, data: {
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
    atualizarApi(id: string, usuarioId: string, data: {
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
    excluirApi(id: string, usuarioId: string): Promise<{
        ok: boolean;
    }>;
    salvarTokenSubOrg(apiId: string, subOrgId: string, usuarioId: string, data: {
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
    removerTokenSubOrg(apiId: string, subOrgId: string, usuarioId: string): Promise<{
        ok: boolean;
    }>;
    listarRotas(apiId: string, usuarioId: string): Promise<{
        id: string;
        criadoEm: Date;
        descricao: string | null;
        apiId: string;
        path: string;
        metodo: string;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    criarRota(apiId: string, usuarioId: string, data: {
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
    atualizarRota(rotaId: string, apiId: string, usuarioId: string, data: {
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
    excluirRota(rotaId: string, apiId: string, usuarioId: string): Promise<{
        ok: boolean;
    }>;
}
