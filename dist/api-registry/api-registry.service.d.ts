import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from '../organization/organization.service';
export declare class ApiRegistryService {
    private prisma;
    private orgService;
    constructor(prisma: PrismaService, orgService: OrganizationService);
    private getOrgIdFromSubOrg;
    private verificarMembroOrg;
    private verificarAcessoApi;
    listarApis(usuarioId: number, subOrgId: number | null): Promise<{
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
    criarApi(usuarioId: number, orgId: number, data: {
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
    atualizarApi(id: number, usuarioId: number, data: {
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
    excluirApi(id: number, usuarioId: number): Promise<{
        ok: boolean;
    }>;
    salvarTokenSubOrg(apiId: number, subOrgId: number, usuarioId: number, data: {
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
    removerTokenSubOrg(apiId: number, subOrgId: number, usuarioId: number): Promise<{
        ok: boolean;
    }>;
    listarRotas(apiId: number, usuarioId: number): Promise<{
        id: number;
        criadoEm: Date;
        descricao: string | null;
        apiId: number;
        path: string;
        metodo: string;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        bodyTemplate: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    criarRota(apiId: number, usuarioId: number, data: {
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
    atualizarRota(rotaId: number, apiId: number, usuarioId: number, data: {
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
    excluirRota(rotaId: number, apiId: number, usuarioId: number): Promise<{
        ok: boolean;
    }>;
}
