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
exports.WsAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
let WsAuthGuard = class WsAuthGuard {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    canActivate(context) {
        const client = context.switchToWs().getClient();
        const token = client.handshake?.auth?.token || client.handshake?.query?.token;
        if (!token)
            return false;
        try {
            const payload = this.authService.verifyToken(token);
            client.data.user = {
                id: payload.id,
                email: payload.email,
                papel: payload.papel,
            };
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.WsAuthGuard = WsAuthGuard;
exports.WsAuthGuard = WsAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], WsAuthGuard);
//# sourceMappingURL=ws-auth.guard.js.map