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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
let UserService = class UserService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listar() {
        return this.prisma.botUsuario.findMany({
            select: { id: true, email: true, nome: true, papel: true, ativo: true, criadoEm: true, atualizadoEm: true },
            orderBy: { criadoEm: 'desc' },
        });
    }
    async criar(email, senha, nome, papel) {
        const senhaHash = await bcrypt.hash(senha, 10);
        try {
            return await this.prisma.botUsuario.create({
                data: { email, senhaHash, nome: nome || '', papel: papel || 'admin' },
                select: { id: true, email: true, nome: true, papel: true, ativo: true, criadoEm: true },
            });
        }
        catch (err) {
            if (err.code === 'P2002')
                throw new common_1.BadRequestException('Email já cadastrado');
            throw err;
        }
    }
    async atualizar(id, data) {
        const updateData = {
            nome: data.nome,
            email: data.email,
            papel: data.papel,
            ativo: data.ativo,
        };
        if (data.senha) {
            updateData.senhaHash = await bcrypt.hash(data.senha, 10);
        }
        try {
            return await this.prisma.botUsuario.update({
                where: { id },
                data: updateData,
                select: { id: true, email: true, nome: true, papel: true, ativo: true, criadoEm: true, atualizadoEm: true },
            });
        }
        catch (err) {
            if (err.code === 'P2025')
                throw new common_1.NotFoundException('Usuário não encontrado');
            if (err.code === 'P2002')
                throw new common_1.BadRequestException('Email já cadastrado');
            throw err;
        }
    }
    async excluir(id, usuarioAtualId) {
        if (id === usuarioAtualId) {
            throw new common_1.BadRequestException('Você não pode excluir sua própria conta');
        }
        try {
            await this.prisma.botUsuario.delete({ where: { id } });
            return { ok: true };
        }
        catch (err) {
            if (err.code === 'P2025')
                throw new common_1.NotFoundException('Usuário não encontrado');
            throw err;
        }
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserService);
//# sourceMappingURL=user.service.js.map