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
var EstadoRepository_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EstadoRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let EstadoRepository = EstadoRepository_1 = class EstadoRepository {
    prisma;
    logger = new common_1.Logger(EstadoRepository_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async obterConfigEstado(estado) {
        try {
            const row = await this.prisma.botEstadoConfig.findFirst({
                where: { estado, ativo: true },
                select: { handler: true, descricao: true, config: true },
            });
            if (!row)
                return null;
            return {
                handler: row.handler,
                descricao: row.descricao,
                config: row.config ?? {},
            };
        }
        catch (err) {
            this.logger.error(`Erro ao consultar estado ${estado}: ${err.message}`);
            return null;
        }
    }
    async buscarProximoEstado(estadoAtual, entrada) {
        try {
            let row = await this.prisma.botEstadoTransicao.findFirst({
                where: { estadoOrigem: estadoAtual, entrada, ativo: true },
                select: { estadoDestino: true },
            });
            if (row)
                return row.estadoDestino;
            if (entrada !== '*') {
                row = await this.prisma.botEstadoTransicao.findFirst({
                    where: { estadoOrigem: estadoAtual, entrada: '*', ativo: true },
                    select: { estadoDestino: true },
                });
                if (row)
                    return row.estadoDestino;
            }
            return null;
        }
        catch (err) {
            this.logger.error(`Erro ao buscar próximo estado de ${estadoAtual} via ${entrada}: ${err.message}`);
            return null;
        }
    }
    async obterEstadoUsuario(chatId) {
        try {
            const row = await this.prisma.botEstadoUsuario.findUnique({
                where: { chatId },
                select: { estadoAtual: true },
            });
            return row?.estadoAtual ?? null;
        }
        catch (err) {
            this.logger.error(`Erro ao obter estado do usuário: ${err.message}`);
            return null;
        }
    }
    async salvarEstadoUsuario(chatId, estado, nome) {
        try {
            await this.prisma.botEstadoUsuario.upsert({
                where: { chatId },
                update: { estadoAtual: estado, nome: nome || undefined },
                create: { chatId, estadoAtual: estado, nome: nome || undefined },
            });
        }
        catch (err) {
            this.logger.error(`Erro ao salvar estado do usuário: ${err.message}`);
        }
    }
    async registrarTransicao(chatId, estadoAnterior, estadoNovo, mensagemGatilho) {
        try {
            await this.prisma.botEstadoHistorico.create({
                data: { chatId, estadoAnterior, estadoNovo, mensagemGatilho },
            });
        }
        catch (err) {
            this.logger.error(`Erro ao registrar transição: ${err.message}`);
        }
    }
    async obterEstadoInicial() {
        try {
            const row = await this.prisma.botEstadoConfig.findFirst({
                where: {
                    ativo: true,
                    nodeType: 'start',
                    fluxo: { ativo: true },
                },
                select: { estado: true },
            });
            return row?.estado || 'NOVO';
        }
        catch {
            return 'NOVO';
        }
    }
};
exports.EstadoRepository = EstadoRepository;
exports.EstadoRepository = EstadoRepository = EstadoRepository_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EstadoRepository);
//# sourceMappingURL=estado.repository.js.map