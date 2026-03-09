import { PrismaService } from '../prisma/prisma.service';
export declare class OrganizationService {
    private prisma;
    constructor(prisma: PrismaService);
    getSubOrgsAcessiveis(usuarioId: number): Promise<any[]>;
    verificarAcessoSubOrg(usuarioId: number, subOrgId: number): Promise<boolean>;
    listarOrganizacoes(usuarioId: number): Promise<{
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
    criarOrganizacao(usuarioId: number, data: {
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
    obterOrganizacao(orgId: number, usuarioId: number): Promise<({
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
    atualizarOrganizacao(orgId: number, usuarioId: number, data: {
        nome?: string;
    }): Promise<{
        id: number;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    excluirOrganizacao(orgId: number, usuarioId: number): Promise<{
        ok: boolean;
    }>;
    listarMembros(orgId: number, usuarioId: number): Promise<({
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
    adicionarMembro(orgId: number, solicitanteId: number, emailConvidado: string, papel?: string): Promise<{
        id: number;
        organizacaoId: number;
        usuarioId: number;
        papel: string;
        criadoEm: Date;
    }>;
    removerMembro(orgId: number, solicitanteId: number, membroId: number): Promise<{
        ok: boolean;
    }>;
    listarSubOrgs(orgId: number, usuarioId: number): Promise<({
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
    criarSubOrg(orgId: number, usuarioId: number, data: {
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
    atualizarSubOrg(orgId: number, subOrgId: number, usuarioId: number, data: {
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
    excluirSubOrg(orgId: number, subOrgId: number, usuarioId: number): Promise<{
        ok: boolean;
    }>;
    transferirSubOrg(subOrgId: number, novaOrgId: number, usuarioId: number): Promise<{
        id: number;
        organizacaoId: number;
        criadoEm: Date;
        nome: string;
        slug: string;
        ativa: boolean;
        atualizadoEm: Date;
    }>;
    adicionarMembroSubOrg(orgId: number, subOrgId: number, solicitanteId: number, emailConvidado: string, papel?: string): Promise<{
        id: number;
        usuarioId: number;
        papel: string;
        criadoEm: Date;
        subOrganizacaoId: number;
    }>;
    removerMembroSubOrg(orgId: number, subOrgId: number, solicitanteId: number, membroId: number): Promise<{
        ok: boolean;
    }>;
    private verificarMembroOrg;
    private verificarPapelOrg;
    private gerarSlug;
}
