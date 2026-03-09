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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const admin_service_1 = require("./admin.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    listarEstados() {
        return this.adminService.listarEstados();
    }
    criarEstado(body) {
        return this.adminService.criarEstado(body);
    }
    atualizarEstado(estado, body) {
        return this.adminService.atualizarEstado(estado, body);
    }
    excluirEstado(estado) {
        return this.adminService.excluirEstado(estado);
    }
    listarTransicoes() {
        return this.adminService.listarTransicoes();
    }
    criarTransicao(body) {
        return this.adminService.criarTransicao(body);
    }
    atualizarTransicao(id, body) {
        return this.adminService.atualizarTransicao(id, body);
    }
    excluirTransicao(id) {
        return this.adminService.excluirTransicao(id);
    }
    testarRequisicao(body) {
        return this.adminService.testarRequisicao(body);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('estados'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listarEstados", null);
__decorate([
    (0, common_1.Post)('estados'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "criarEstado", null);
__decorate([
    (0, common_1.Put)('estados/:estado'),
    __param(0, (0, common_1.Param)('estado')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "atualizarEstado", null);
__decorate([
    (0, common_1.Delete)('estados/:estado'),
    __param(0, (0, common_1.Param)('estado')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "excluirEstado", null);
__decorate([
    (0, common_1.Get)('transicoes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listarTransicoes", null);
__decorate([
    (0, common_1.Post)('transicoes'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "criarTransicao", null);
__decorate([
    (0, common_1.Put)('transicoes/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "atualizarTransicao", null);
__decorate([
    (0, common_1.Delete)('transicoes/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "excluirTransicao", null);
__decorate([
    (0, common_1.Post)('testar-req'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "testarRequisicao", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map