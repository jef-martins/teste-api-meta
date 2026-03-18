"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let OrganizationService = class OrganizationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSubOrgsAcessiveis(usuarioId) {
        const orgMembros = await this.prisma.orgMembro.findMany({
            where: { usuarioId },
            select: { organizacaoId: true },
        });
        const orgIds = orgMembros.map((o) => o.organizacaoId);
        const viaOrg = orgIds.length > 0
            ? await this.prisma.subOrganizacao.findMany({
                where: { organizacaoId: { in: orgIds }, ativa: true },
                include: {
                    organizacao: { select: { id: true, nome: true, slug: true } },
                },
            })
            : [];
        const subOrgMembros = await this.prisma.subOrgMembro.findMany({
            where: { usuarioId },
            include: {
                subOrganizacao: {
                    include: {
                        organizacao: { select: { id: true, nome: true, slug: true } },
                    },
                },
            },
        });
        const todas = new Map();
        for (const s of viaOrg)
            todas.set(s.id, s);
        for (const m of subOrgMembros) {
            if (m.subOrganizacao && m.subOrganizacao.ativa) {
                todas.set(m.subOrganizacao.id, m.subOrganizacao);
            }
        }
        return Array.from(todas.values());
    }
    async verificarAcessoSubOrg(usuarioId, subOrgId) {
        const acessiveis = await this.getSubOrgsAcessiveis(usuarioId);
        return acessiveis.some((s) => s.id === subOrgId);
    }
    async listarOrganizacoes(usuarioId) {
        const membros = await this.prisma.orgMembro.findMany({
            where: { usuarioId },
            include: {
                organizacao: {
                    include: {
                        subOrganizacoes: {
                            where: { ativa: true },
                            select: { id: true, nome: true, slug: true },
                        },
                        _count: { select: { membros: true } },
                    },
                },
            },
        });
        return membros.map((m) => ({
            ...m.organizacao,
            papel: m.papel,
        }));
    }
    async criarOrganizacao(usuarioId, data) {
        if (!data.nome)
            throw new common_1.BadRequestException('Nome é obrigatório');
        let slug = data.slug || this.gerarSlug(data.nome);
        const slugBase = slug;
        let tentativa = 0;
        while (true) {
            const existe = await this.prisma.organizacao.findUnique({
                where: { slug },
            });
            if (!existe)
                break;
            tentativa++;
            slug = `${slugBase}-${tentativa}`;
        }
        const org = await this.prisma.organizacao.create({
            data: { nome: data.nome, slug },
        });
        await this.prisma.orgMembro.create({
            data: { organizacaoId: org.id, usuarioId, papel: 'dono' },
        });
        return org;
    }
    async obterOrganizacao(orgId, usuarioId) {
        await this.verificarMembroOrg(orgId, usuarioId);
        return this.prisma.organizacao.findUnique({
            where: { id: orgId },
            include: {
                subOrganizacoes: { where: { ativa: true } },
                membros: {
                    include: {
                        usuario: { select: { id: true, email: true, nome: true } },
                    },
                },
            },
        });
    }
    async atualizarOrganizacao(orgId, usuarioId, data) {
        await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin']);
        return this.prisma.organizacao.update({
            where: { id: orgId },
            data,
        });
    }
    async excluirOrganizacao(orgId, usuarioId) {
        await this.verificarPapelOrg(orgId, usuarioId, ['dono']);
        await this.prisma.organizacao.delete({ where: { id: orgId } });
        return { ok: true };
    }
    async listarMembros(orgId, usuarioId) {
        await this.verificarMembroOrg(orgId, usuarioId);
        return this.prisma.orgMembro.findMany({
            where: { organizacaoId: orgId },
            include: { usuario: { select: { id: true, email: true, nome: true } } },
        });
    }
    async adicionarMembro(orgId, solicitanteId, emailConvidado, papel = 'membro') {
        await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin']);
        const usuario = await this.prisma.botUsuario.findUnique({
            where: { email: emailConvidado },
        });
        if (!usuario)
            throw new common_1.NotFoundException('Usuário não encontrado');
        const jaExiste = await this.prisma.orgMembro.findUnique({
            where: {
                organizacaoId_usuarioId: {
                    organizacaoId: orgId,
                    usuarioId: usuario.id,
                },
            },
        });
        if (jaExiste)
            throw new common_1.BadRequestException('Usuário já é membro desta organização');
        return this.prisma.orgMembro.create({
            data: { organizacaoId: orgId, usuarioId: usuario.id, papel },
        });
    }
    async removerMembro(orgId, solicitanteId, membroId) {
        await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin']);
        await this.prisma.orgMembro.delete({
            where: {
                organizacaoId_usuarioId: {
                    organizacaoId: orgId,
                    usuarioId: membroId,
                },
            },
        });
        return { ok: true };
    }
    async listarSubOrgs(orgId, usuarioId) {
        await this.verificarMembroOrg(orgId, usuarioId);
        return this.prisma.subOrganizacao.findMany({
            where: { organizacaoId: orgId },
            include: {
                _count: { select: { membros: true, fluxos: true } },
            },
        });
    }
    async criarSubOrg(orgId, usuarioId, data) {
        await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin']);
        if (!data.nome)
            throw new common_1.BadRequestException('Nome é obrigatório');
        let slug = data.slug || this.gerarSlug(data.nome);
        const slugBase = slug;
        let tentativa = 0;
        while (true) {
            const existe = await this.prisma.subOrganizacao.findUnique({
                where: { organizacaoId_slug: { organizacaoId: orgId, slug } },
            });
            if (!existe)
                break;
            tentativa++;
            slug = `${slugBase}-${tentativa}`;
        }
        return this.prisma.subOrganizacao.create({
            data: { organizacaoId: orgId, nome: data.nome, slug },
        });
    }
    async atualizarSubOrg(orgId, subOrgId, usuarioId, data) {
        await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin']);
        return this.prisma.subOrganizacao.update({
            where: { id: subOrgId },
            data,
        });
    }
    async excluirSubOrg(orgId, subOrgId, usuarioId) {
        await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin']);
        await this.prisma.subOrganizacao.delete({ where: { id: subOrgId } });
        return { ok: true };
    }
    async transferirSubOrg(subOrgId, novaOrgId, usuarioId) {
        const subOrg = await this.prisma.subOrganizacao.findUnique({
            where: { id: subOrgId },
        });
        if (!subOrg)
            throw new common_1.NotFoundException('Sub-organização não encontrada');
        await this.verificarPapelOrg(subOrg.organizacaoId, usuarioId, [
            'dono',
            'admin',
        ]);
        await this.verificarPapelOrg(novaOrgId, usuarioId, ['dono', 'admin']);
        const slug = subOrg.slug;
        const conflito = await this.prisma.subOrganizacao.findUnique({
            where: { organizacaoId_slug: { organizacaoId: novaOrgId, slug } },
        });
        const novoSlug = conflito ? `${slug}-${Date.now()}` : slug;
        return this.prisma.subOrganizacao.update({
            where: { id: subOrgId },
            data: { organizacaoId: novaOrgId, slug: novoSlug },
        });
    }
    async adicionarMembroSubOrg(orgId, subOrgId, solicitanteId, emailConvidado, papel = 'membro') {
        await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin']);
        const usuario = await this.prisma.botUsuario.findUnique({
            where: { email: emailConvidado },
        });
        if (!usuario)
            throw new common_1.NotFoundException('Usuário não encontrado');
        const jaExiste = await this.prisma.subOrgMembro.findUnique({
            where: {
                subOrganizacaoId_usuarioId: {
                    subOrganizacaoId: subOrgId,
                    usuarioId: usuario.id,
                },
            },
        });
        if (jaExiste)
            throw new common_1.BadRequestException('Usuário já é membro desta sub-organização');
        return this.prisma.subOrgMembro.create({
            data: { subOrganizacaoId: subOrgId, usuarioId: usuario.id, papel },
        });
    }
    async removerMembroSubOrg(orgId, subOrgId, solicitanteId, membroId) {
        await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin']);
        await this.prisma.subOrgMembro.delete({
            where: {
                subOrganizacaoId_usuarioId: {
                    subOrganizacaoId: subOrgId,
                    usuarioId: membroId,
                },
            },
        });
        return { ok: true };
    }
    async verificarMembroOrg(orgId, usuarioId) {
        const membro = await this.prisma.orgMembro.findUnique({
            where: { organizacaoId_usuarioId: { organizacaoId: orgId, usuarioId } },
        });
        if (!membro)
            throw new common_1.ForbiddenException('Sem acesso a esta organização');
    }
    async verificarPapelOrg(orgId, usuarioId, papeisPermitidos) {
        const membro = await this.prisma.orgMembro.findUnique({
            where: { organizacaoId_usuarioId: { organizacaoId: orgId, usuarioId } },
        });
        if (!membro || !papeisPermitidos.includes(membro.papel)) {
            throw new common_1.ForbiddenException('Permissão insuficiente');
        }
    }
    gerarSlug(nome) {
        return nome
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 100);
    }
};
exports.OrganizationService = OrganizationService;
exports.OrganizationService = OrganizationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrganizationService);
//# sourceMappingURL=organization.service.js.map