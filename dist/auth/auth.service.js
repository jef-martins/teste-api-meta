"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const organization_service_1 = require("../organization/organization.service");
let AuthService = class AuthService {
    prisma;
    jwtService;
    orgService;
    constructor(prisma, jwtService, orgService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.orgService = orgService;
    }
    async login(email, senha) {
        const usuario = await this.prisma.botUsuario.findUnique({
            where: { email },
        });
        if (!usuario)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        if (!usuario.ativo)
            throw new common_1.UnauthorizedException('Usuário inativo');
        const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
        if (!senhaCorreta)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        const token = this.gerarToken(usuario);
        const subOrgsAcessiveis = await this.orgService.getSubOrgsAcessiveis(usuario.id);
        return {
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email,
                nome: usuario.nome,
                papel: usuario.papel,
            },
            subOrgsAcessiveis,
        };
    }
    async setup(email, senha, nome) {
        const count = await this.prisma.botUsuario.count();
        if (count > 0) {
            throw new common_1.UnauthorizedException('Setup já realizado. Use login.');
        }
        const senhaHash = await bcrypt.hash(senha, 10);
        const usuario = await this.prisma.botUsuario.create({
            data: { email, senhaHash, nome: nome || 'Admin', papel: 'admin' },
            select: { id: true, email: true, nome: true, papel: true },
        });
        const token = this.gerarToken(usuario);
        return { token, usuario };
    }
    async register(email, senha, nome) {
        const senhaHash = await bcrypt.hash(senha, 10);
        const usuario = await this.prisma.botUsuario.create({
            data: { email, senhaHash, nome: nome || 'Admin', papel: 'admin' },
            select: { id: true, email: true, nome: true, papel: true },
        });
        const token = this.gerarToken(usuario);
        const subOrgsAcessiveis = await this.orgService.getSubOrgsAcessiveis(usuario.id);
        return { token, usuario, subOrgsAcessiveis };
    }
    async getMe(userId) {
        const usuario = await this.prisma.botUsuario.findUnique({
            where: { id: userId },
            select: { id: true, email: true, nome: true, papel: true },
        });
        if (!usuario)
            throw new common_1.UnauthorizedException('Usuário não encontrado');
        return usuario;
    }
    gerarToken(usuario) {
        return this.jwtService.sign({
            id: usuario.id,
            email: usuario.email,
            papel: usuario.papel,
        });
    }
    verifyToken(token) {
        return this.jwtService.verify(token);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        organization_service_1.OrganizationService])
], AuthService);
//# sourceMappingURL=auth.service.js.map