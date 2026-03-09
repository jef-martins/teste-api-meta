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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const organization_service_1 = require("./organization.service");
let OrganizationController = class OrganizationController {
    orgService;
    constructor(orgService) {
        this.orgService = orgService;
    }
    minhasSubOrgs(req) {
        return this.orgService.getSubOrgsAcessiveis(req.user.id);
    }
    listar(req) {
        return this.orgService.listarOrganizacoes(req.user.id);
    }
    criar(req, body) {
        return this.orgService.criarOrganizacao(req.user.id, body);
    }
    obter(orgId, req) {
        return this.orgService.obterOrganizacao(orgId, req.user.id);
    }
    atualizar(orgId, req, body) {
        return this.orgService.atualizarOrganizacao(orgId, req.user.id, body);
    }
    excluir(orgId, req) {
        return this.orgService.excluirOrganizacao(orgId, req.user.id);
    }
    listarMembros(orgId, req) {
        return this.orgService.listarMembros(orgId, req.user.id);
    }
    adicionarMembro(orgId, req, body) {
        return this.orgService.adicionarMembro(orgId, req.user.id, body.email, body.papel);
    }
    removerMembro(orgId, membroId, req) {
        return this.orgService.removerMembro(orgId, req.user.id, membroId);
    }
    listarSubOrgs(orgId, req) {
        return this.orgService.listarSubOrgs(orgId, req.user.id);
    }
    criarSubOrg(orgId, req, body) {
        return this.orgService.criarSubOrg(orgId, req.user.id, body);
    }
    atualizarSubOrg(orgId, subOrgId, req, body) {
        return this.orgService.atualizarSubOrg(orgId, subOrgId, req.user.id, body);
    }
    excluirSubOrg(orgId, subOrgId, req) {
        return this.orgService.excluirSubOrg(orgId, subOrgId, req.user.id);
    }
    transferirSubOrg(subOrgId, req, body) {
        return this.orgService.transferirSubOrg(subOrgId, body.novaOrgId, req.user.id);
    }
    adicionarMembroSubOrg(orgId, subOrgId, req, body) {
        return this.orgService.adicionarMembroSubOrg(orgId, subOrgId, req.user.id, body.email, body.papel);
    }
    removerMembroSubOrg(orgId, subOrgId, membroId, req) {
        return this.orgService.removerMembroSubOrg(orgId, subOrgId, req.user.id, membroId);
    }
};
exports.OrganizationController = OrganizationController;
__decorate([
    (0, common_1.Get)('minhas-sub-orgs'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "minhasSubOrgs", null);
__decorate([
    (0, common_1.Get)('organizacoes'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "listar", null);
__decorate([
    (0, common_1.Post)('organizacoes'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "criar", null);
__decorate([
    (0, common_1.Get)('organizacoes/:orgId'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "obter", null);
__decorate([
    (0, common_1.Put)('organizacoes/:orgId'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "atualizar", null);
__decorate([
    (0, common_1.Delete)('organizacoes/:orgId'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "excluir", null);
__decorate([
    (0, common_1.Get)('organizacoes/:orgId/membros'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "listarMembros", null);
__decorate([
    (0, common_1.Post)('organizacoes/:orgId/membros'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "adicionarMembro", null);
__decorate([
    (0, common_1.Delete)('organizacoes/:orgId/membros/:membroId'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('membroId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "removerMembro", null);
__decorate([
    (0, common_1.Get)('organizacoes/:orgId/sub-orgs'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "listarSubOrgs", null);
__decorate([
    (0, common_1.Post)('organizacoes/:orgId/sub-orgs'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "criarSubOrg", null);
__decorate([
    (0, common_1.Put)('organizacoes/:orgId/sub-orgs/:subOrgId'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('subOrgId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "atualizarSubOrg", null);
__decorate([
    (0, common_1.Delete)('organizacoes/:orgId/sub-orgs/:subOrgId'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('subOrgId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "excluirSubOrg", null);
__decorate([
    (0, common_1.Post)('organizacoes/:orgId/sub-orgs/:subOrgId/transferir'),
    __param(0, (0, common_1.Param)('subOrgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "transferirSubOrg", null);
__decorate([
    (0, common_1.Post)('organizacoes/:orgId/sub-orgs/:subOrgId/membros'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('subOrgId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "adicionarMembroSubOrg", null);
__decorate([
    (0, common_1.Delete)('organizacoes/:orgId/sub-orgs/:subOrgId/membros/:membroId'),
    __param(0, (0, common_1.Param)('orgId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('subOrgId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('membroId', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number, Object]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "removerMembroSubOrg", null);
exports.OrganizationController = OrganizationController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [organization_service_1.OrganizationService])
], OrganizationController);
//# sourceMappingURL=organization.controller.js.map