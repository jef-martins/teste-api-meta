import { OrganizationService } from './organization.service';
export declare class OrganizationController {
    private orgService;
    constructor(orgService: OrganizationService);
    minhasSubOrgs(req: any): Promise<any[]>;
    listar(req: any): Promise<{
        papel: string;
        _count: {
            membros: number;
        };
        subOrganizacoes: {
            id: string;
            nome: string;
            slug: string;
        }[];
        id: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }[]>;
    criar(req: any, body: {
        nome: string;
        slug?: string;
    }): Promise<{
        id: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    obter(orgId: string, req: any): Promise<({
        membros: ({
            usuario: {
                id: string;
                nome: string | null;
                email: string;
            };
        } & {
            id: string;
            organizacaoId: string;
            usuarioId: string;
            papel: string;
            criadoEm: Date;
        })[];
        subOrganizacoes: {
            id: string;
            organizacaoId: string;
            criadoEm: Date;
            nome: string;
            slug: string;
            ativa: boolean;
            atualizadoEm: Date;
        }[];
    } & {
        id: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }) | null>;
    atualizar(orgId: string, req: any, body: {
        nome?: string;
    }): Promise<{
        id: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    excluir(orgId: string, req: any): Promise<{
        ok: boolean;
    }>;
    listarMembros(orgId: string, req: any): Promise<({
        usuario: {
            id: string;
            nome: string | null;
            email: string;
        };
    } & {
        id: string;
        organizacaoId: string;
        usuarioId: string;
        papel: string;
        criadoEm: Date;
    })[]>;
    adicionarMembro(orgId: string, req: any, body: {
        email: string;
        papel?: string;
    }): Promise<{
        id: string;
        organizacaoId: string;
        usuarioId: string;
        papel: string;
        criadoEm: Date;
    }>;
    removerMembro(orgId: string, membroId: string, req: any): Promise<{
        ok: boolean;
    }>;
    listarSubOrgs(orgId: string, req: any): Promise<({
        _count: {
            membros: number;
            fluxos: number;
        };
    } & {
        id: string;
        organizacaoId: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    })[]>;
    criarSubOrg(orgId: string, req: any, body: {
        nome: string;
        slug?: string;
    }): Promise<{
        id: string;
        organizacaoId: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    atualizarSubOrg(orgId: string, subOrgId: string, req: any, body: {
        nome?: string;
    }): Promise<{
        id: string;
        organizacaoId: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    excluirSubOrg(orgId: string, subOrgId: string, req: any): Promise<{
        ok: boolean;
    }>;
    transferirSubOrg(subOrgId: string, req: any, body: {
        novaOrgId: string;
    }): Promise<{
        id: string;
        organizacaoId: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    adicionarMembroSubOrg(orgId: string, subOrgId: string, req: any, body: {
        email: string;
        papel?: string;
    }): Promise<{
        id: string;
        usuarioId: string;
        papel: string;
        criadoEm: Date;
        subOrganizacaoId: string;
    }>;
    removerMembroSubOrg(orgId: string, subOrgId: string, membroId: string, req: any): Promise<{
        ok: boolean;
    }>;
}
