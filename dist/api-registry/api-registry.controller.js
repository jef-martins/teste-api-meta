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
exports.ApiRegistryController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const api_registry_service_1 = require("./api-registry.service");
let ApiRegistryController = class ApiRegistryController {
    service;
    constructor(service) {
        this.service = service;
    }
    getSubOrgId(headers) {
        const raw = headers['x-suborg-id'];
        const parsed = raw ? parseInt(raw) : NaN;
        return isNaN(parsed) ? null : parsed;
    }
    getOrgId(headers) {
        const raw = headers['x-org-id'];
        const parsed = raw ? parseInt(raw) : NaN;
        return isNaN(parsed) ? null : parsed;
    }
    listar(req, headers) {
        const subOrgId = this.getSubOrgId(headers);
        return this.service.listarApis(req.user.id, subOrgId);
    }
    criar(req, headers, body) {
        const orgId = this.getOrgId(headers);
        if (!orgId)
            throw new Error('Header X-Org-Id é obrigatório para criar uma API');
        return this.service.criarApi(req.user.id, orgId, body);
    }
    atualizar(id, req, body) {
        return this.service.atualizarApi(id, req.user.id, body);
    }
    excluir(id, req) {
        return this.service.excluirApi(id, req.user.id);
    }
    salvarToken(apiId, headers, req, body) {
        const subOrgId = this.getSubOrgId(headers);
        if (!subOrgId)
            throw new Error('Header X-SubOrg-Id é obrigatório');
        return this.service.salvarTokenSubOrg(apiId, subOrgId, req.user.id, body);
    }
    removerToken(apiId, headers, req) {
        const subOrgId = this.getSubOrgId(headers);
        if (!subOrgId)
            throw new Error('Header X-SubOrg-Id é obrigatório');
        return this.service.removerTokenSubOrg(apiId, subOrgId, req.user.id);
    }
    listarRotas(apiId, req) {
        return this.service.listarRotas(apiId, req.user.id);
    }
    criarRota(apiId, req, body) {
        return this.service.criarRota(apiId, req.user.id, body);
    }
    atualizarRota(apiId, rotaId, req, body) {
        return this.service.atualizarRota(rotaId, apiId, req.user.id, body);
    }
    excluirRota(apiId, rotaId, req) {
        return this.service.excluirRota(rotaId, apiId, req.user.id);
    }
};
exports.ApiRegistryController = ApiRegistryController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "listar", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "criar", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "atualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "excluir", null);
__decorate([
    (0, common_1.Post)(':apiId/token'),
    __param(0, (0, common_1.Param)('apiId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "salvarToken", null);
__decorate([
    (0, common_1.Delete)(':apiId/token'),
    __param(0, (0, common_1.Param)('apiId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "removerToken", null);
__decorate([
    (0, common_1.Get)(':apiId/rotas'),
    __param(0, (0, common_1.Param)('apiId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "listarRotas", null);
__decorate([
    (0, common_1.Post)(':apiId/rotas'),
    __param(0, (0, common_1.Param)('apiId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "criarRota", null);
__decorate([
    (0, common_1.Put)(':apiId/rotas/:rotaId'),
    __param(0, (0, common_1.Param)('apiId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('rotaId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "atualizarRota", null);
__decorate([
    (0, common_1.Delete)(':apiId/rotas/:rotaId'),
    __param(0, (0, common_1.Param)('apiId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('rotaId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", void 0)
], ApiRegistryController.prototype, "excluirRota", null);
exports.ApiRegistryController = ApiRegistryController = __decorate([
    (0, common_1.Controller)('api-registry'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [api_registry_service_1.ApiRegistryService])
], ApiRegistryController);
//# sourceMappingURL=api-registry.controller.js.map