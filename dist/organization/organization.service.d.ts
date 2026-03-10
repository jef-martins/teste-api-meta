import { PrismaService } from '../prisma/prisma.service';
export declare class OrganizationService {
    private prisma;
    constructor(prisma: PrismaService);
    getSubOrgsAcessiveis(usuarioId: string): Promise<any[]>;
    verificarAcessoSubOrg(usuarioId: string, subOrgId: string): Promise<boolean>;
    listarOrganizacoes(usuarioId: string): Promise<{
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
    criarOrganizacao(usuarioId: string, data: {
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
    obterOrganizacao(orgId: string, usuarioId: string): Promise<({
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
    atualizarOrganizacao(orgId: string, usuarioId: string, data: {
        nome?: string;
    }): Promise<{
        id: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    excluirOrganizacao(orgId: string, usuarioId: string): Promise<{
        ok: boolean;
    }>;
    listarMembros(orgId: string, usuarioId: string): Promise<({
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
    adicionarMembro(orgId: string, solicitanteId: string, emailConvidado: string, papel?: string): Promise<{
        id: string;
        organizacaoId: string;
        usuarioId: string;
        papel: string;
        criadoEm: Date;
    }>;
    removerMembro(orgId: string, solicitanteId: string, membroId: string): Promise<{
        ok: boolean;
    }>;
    listarSubOrgs(orgId: string, usuarioId: string): Promise<({
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
    criarSubOrg(orgId: string, usuarioId: string, data: {
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
    atualizarSubOrg(orgId: string, subOrgId: string, usuarioId: string, data: {
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
    excluirSubOrg(orgId: string, subOrgId: string, usuarioId: string): Promise<{
        ok: boolean;
    }>;
    transferirSubOrg(subOrgId: string, novaOrgId: string, usuarioId: string): Promise<{
        id: string;
        organizacaoId: string;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    adicionarMembroSubOrg(orgId: string, subOrgId: string, solicitanteId: string, emailConvidado: string, papel?: string): Promise<{
        id: string;
        usuarioId: string;
        papel: string;
        criadoEm: Date;
        subOrganizacaoId: string;
    }>;
    removerMembroSubOrg(orgId: string, subOrgId: string, solicitanteId: string, membroId: string): Promise<{
        ok: boolean;
    }>;
    private verificarMembroOrg;
    private verificarPapelOrg;
    private gerarSlug;
}
