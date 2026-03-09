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
exports.FlowController = void 0;
const common_1 = require("@nestjs/common");
const flow_service_1 = require("./flow.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const organization_service_1 = require("../organization/organization.service");
let FlowController = class FlowController {
    flowService;
    orgService;
    constructor(flowService, orgService) {
        this.flowService = flowService;
        this.orgService = orgService;
    }
    getSubOrgId(headers) {
        const raw = headers['x-suborg-id'];
        const parsed = raw ? parseInt(raw) : NaN;
        return isNaN(parsed) ? null : parsed;
    }
    listar(headers) {
        const subOrgId = this.getSubOrgId(headers);
        return this.flowService.listar(subOrgId);
    }
    obter(id) {
        return this.flowService.obter(id);
    }
    async criar(body, headers, req) {
        const subOrgId = this.getSubOrgId(headers);
        if (subOrgId) {
            const temAcesso = await this.orgService.verificarAcessoSubOrg(req.user.id, subOrgId);
            if (!temAcesso) {
                throw new Error('Sem acesso a esta sub-organização');
            }
        }
        return this.flowService.criar({ ...body, subOrganizacaoId: subOrgId });
    }
    atualizar(id, body) {
        return this.flowService.atualizar(id, body);
    }
    excluir(id) {
        return this.flowService.excluir(id);
    }
    ativar(id) {
        return this.flowService.ativar(id);
    }
};
exports.FlowController = FlowController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FlowController.prototype, "listar", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], FlowController.prototype, "obter", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], FlowController.prototype, "criar", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], FlowController.prototype, "atualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], FlowController.prototype, "excluir", null);
__decorate([
    (0, common_1.Post)(':id/ativar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], FlowController.prototype, "ativar", null);
exports.FlowController = FlowController = __decorate([
    (0, common_1.Controller)('fluxos'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [flow_service_1.FlowService,
        organization_service_1.OrganizationService])
], FlowController);
//# sourceMappingURL=flow.controller.js.map