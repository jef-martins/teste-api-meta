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
            id: number;
            nome: string;
            slug: string;
        }[];
        id: number;
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
        id: number;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    obter(orgId: number, req: any): Promise<({
        membros: ({
            usuario: {
                id: number;
                nome: string | null;
                email: string;
            };
        } & {
            id: number;
            organizacaoId: number;
            usuarioId: number;
            papel: string;
            criadoEm: Date;
        })[];
        subOrganizacoes: {
            id: number;
            organizacaoId: number;
            criadoEm: Date;
            nome: string;
            slug: string;
            ativa: boolean;
            atualizadoEm: Date;
        }[];
    } & {
        id: number;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }) | null>;
    atualizar(orgId: number, req: any, body: {
        nome?: string;
    }): Promise<{
        id: number;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    excluir(orgId: number, req: any): Promise<{
        ok: boolean;
    }>;
    listarMembros(orgId: number, req: any): Promise<({
        usuario: {
            id: number;
            nome: string | null;
            email: string;
        };
    } & {
        id: number;
        organizacaoId: number;
        usuarioId: number;
        papel: string;
        criadoEm: Date;
    })[]>;
    adicionarMembro(orgId: number, req: any, body: {
        email: string;
        papel?: string;
    }): Promise<{
        id: number;
        organizacaoId: number;
        usuarioId: number;
        papel: string;
        criadoEm: Date;
    }>;
    removerMembro(orgId: number, membroId: number, req: any): Promise<{
        ok: boolean;
    }>;
    listarSubOrgs(orgId: number, req: any): Promise<({
        _count: {
            membros: number;
            fluxos: number;
        };
    } & {
        id: number;
        organizacaoId: number;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    })[]>;
    criarSubOrg(orgId: number, req: any, body: {
        nome: string;
        slug?: string;
    }): Promise<{
        id: number;
        organizacaoId: number;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    atualizarSubOrg(orgId: number, subOrgId: number, req: any, body: {
        nome?: string;
    }): Promise<{
        id: number;
        organizacaoId: number;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    excluirSubOrg(orgId: number, subOrgId: number, req: any): Promise<{
        ok: boolean;
    }>;
    transferirSubOrg(subOrgId: number, req: any, body: {
        novaOrgId: number;
    }): Promise<{
        id: number;
        organizacaoId: number;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    adicionarMembroSubOrg(orgId: number, subOrgId: number, req: any, body: {
        email: string;
        papel?: string;
    }): Promise<{
        id: number;
        usuarioId: number;
        papel: string;
        criadoEm: Date;
        subOrganizacaoId: number;
    }>;
    removerMembroSubOrg(orgId: number, subOrgId: number, membroId: number, req: any): Promise<{
        ok: boolean;
    }>;
}
