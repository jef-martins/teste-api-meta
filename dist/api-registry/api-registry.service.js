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
exports.ApiRegistryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const organization_service_1 = require("../organization/organization.service");
let ApiRegistryService = class ApiRegistryService {
    prisma;
    orgService;
    constructor(prisma, orgService) {
        this.prisma = prisma;
        this.orgService = orgService;
    }
    async getOrgIdFromSubOrg(subOrgId) {
        const subOrg = await this.prisma.subOrganizacao.findUnique({
            where: { id: subOrgId },
            select: { organizacaoId: true },
        });
        if (!subOrg)
            throw new common_1.NotFoundException('Sub-organização não encontrada');
        return subOrg.organizacaoId;
    }
    async verificarMembroOrg(orgId, usuarioId) {
        const membro = await this.prisma.orgMembro.findUnique({
            where: { organizacaoId_usuarioId: { organizacaoId: orgId, usuarioId } },
        });
        if (!membro)
            throw new common_1.ForbiddenException('Sem acesso a esta organização');
    }
    async verificarAcessoApi(apiId, usuarioId) {
        const api = await this.prisma.apiRegistrada.findUnique({
            where: { id: apiId },
        });
        if (!api)
            throw new common_1.NotFoundException('API não encontrada');
        await this.verificarMembroOrg(api.organizacaoId, usuarioId);
        return api.organizacaoId;
    }
    async listarApis(usuarioId, subOrgId) {
        let orgId = null;
        if (subOrgId) {
            orgId = await this.getOrgIdFromSubOrg(subOrgId);
            await this.verificarMembroOrg(orgId, usuarioId).catch(async () => {
                const temAcesso = await this.orgService.verificarAcessoSubOrg(usuarioId, subOrgId);
                if (!temAcesso)
                    throw new common_1.ForbiddenException('Sem acesso a esta sub-organização');
            });
        }
        else {
            const orgMembro = await this.prisma.orgMembro.findFirst({
                where: { usuarioId },
                select: { organizacaoId: true },
            });
            orgId = orgMembro?.organizacaoId ?? null;
        }
        if (!orgId)
            return [];
        const apis = await this.prisma.apiRegistrada.findMany({
            where: { organizacaoId: orgId },
            include: {
                rotas: { orderBy: { id: 'asc' } },
                subOrgTokens: subOrgId
                    ? { where: { subOrganizacaoId: subOrgId } }
                    : false,
            },
            orderBy: { criadoEm: 'desc' },
        });
        return apis.map((api) => ({
            ...api,
            tokenSubOrg: subOrgId ? (api.subOrgTokens?.[0] ?? null) : null,
            subOrgTokens: undefined,
        }));
    }
    async criarApi(usuarioId, orgId, data) {
        if (!data.nome)
            throw new common_1.BadRequestException('Nome é obrigatório');
        if (!data.urlBase)
            throw new common_1.BadRequestException('URL base é obrigatória');
        await this.verificarMembroOrg(orgId, usuarioId);
        return this.prisma.apiRegistrada.create({
            data: {
                organizacaoId: orgId,
                nome: data.nome,
                urlBase: data.urlBase,
                headers: data.headers ?? {},
            },
            include: { rotas: true },
        });
    }
    async atualizarApi(id, usuarioId, data) {
        await this.verificarAcessoApi(id, usuarioId);
        return this.prisma.apiRegistrada.update({
            where: { id },
            data,
            include: { rotas: true },
        });
    }
    async excluirApi(id, usuarioId) {
        await this.verificarAcessoApi(id, usuarioId);
        await this.prisma.apiRegistrada.delete({ where: { id } });
        return { ok: true };
    }
    async salvarTokenSubOrg(apiId, subOrgId, usuarioId, data) {
        const temAcesso = await this.orgService.verificarAcessoSubOrg(usuarioId, subOrgId);
        if (!temAcesso)
            throw new common_1.ForbiddenException('Sem acesso a esta sub-organização');
        await this.verificarAcessoApi(apiId, usuarioId);
        return this.prisma.apiSubOrgToken.upsert({
            where: { apiId_subOrganizacaoId: { apiId, subOrganizacaoId: subOrgId } },
            create: {
                apiId,
                subOrganizacaoId: subOrgId,
                token: data.token,
                headers: data.headers ?? {},
            },
            update: {
                token: data.token,
                headers: data.headers ?? {},
            },
        });
    }
    async removerTokenSubOrg(apiId, subOrgId, usuarioId) {
        const temAcesso = await this.orgService.verificarAcessoSubOrg(usuarioId, subOrgId);
        if (!temAcesso)
            throw new common_1.ForbiddenException('Sem acesso a esta sub-organização');
        await this.prisma.apiSubOrgToken.deleteMany({
            where: { apiId, subOrganizacaoId: subOrgId },
        });
        return { ok: true };
    }
    async listarRotas(apiId, usuarioId) {
        await this.verificarAcessoApi(apiId, usuarioId);
        return this.prisma.apiRota.findMany({
            where: { apiId },
            orderBy: { id: 'asc' },
        });
    }
    async criarRota(apiId, usuarioId, data) {
        await this.verificarAcessoApi(apiId, usuarioId);
        if (!data.path)
            throw new common_1.BadRequestException('Path é obrigatório');
        return this.prisma.apiRota.create({
            data: {
                apiId,
                path: data.path,
                metodo: data.metodo || 'GET',
                descricao: data.descricao,
                parametros: data.parametros ?? [],
                bodyTemplate: data.bodyTemplate,
            },
        });
    }
    async atualizarRota(rotaId, apiId, usuarioId, data) {
        await this.verificarAcessoApi(apiId, usuarioId);
        const rota = await this.prisma.apiRota.findUnique({
            where: { id: rotaId },
        });
        if (!rota || rota.apiId !== apiId)
            throw new common_1.NotFoundException('Rota não encontrada');
        return this.prisma.apiRota.update({ where: { id: rotaId }, data });
    }
    async excluirRota(rotaId, apiId, usuarioId) {
        await this.verificarAcessoApi(apiId, usuarioId);
        const rota = await this.prisma.apiRota.findUnique({
            where: { id: rotaId },
        });
        if (!rota || rota.apiId !== apiId)
            throw new common_1.NotFoundException('Rota não encontrada');
        await this.prisma.apiRota.delete({ where: { id: rotaId } });
        return { ok: true };
    }
};
exports.ApiRegistryService = ApiRegistryService;
exports.ApiRegistryService = ApiRegistryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        organization_service_1.OrganizationService])
], ApiRegistryService);
//# sourceMappingURL=api-registry.service.js.map