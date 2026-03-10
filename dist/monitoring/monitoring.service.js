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
exports.MonitoringService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let MonitoringService = class MonitoringService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listarSessoes() {
        return this.prisma.$queryRaw `
      SELECT u.chat_id, u.nome, u.estado_atual, u.atualizado_em,
             e.handler, e.descricao AS estado_descricao
      FROM bot_estado_usuario u
      LEFT JOIN bot_estado_config e ON u.estado_atual = e.estado
      ORDER BY u.atualizado_em DESC
    `;
    }
    async detalhesSessao(chatId) {
        const usuario = await this.prisma.botEstadoUsuario.findUnique({ where: { chatId } });
        if (!usuario)
            throw new common_1.NotFoundException('Sessão não encontrada');
        const historico = await this.prisma.botEstadoHistorico.findMany({
            where: { chatId },
            orderBy: { criadoEm: 'desc' },
            take: 50,
        });
        const mensagens = await this.prisma.conversa.findMany({
            where: { OR: [{ quemEnviou: chatId }, { paraQuem: chatId }] },
            orderBy: { criadoEm: 'desc' },
            take: 50,
        });
        return { usuario, historico, mensagens };
    }
    async historico(chatId) {
        return this.prisma.botEstadoHistorico.findMany({
            where: { chatId },
            orderBy: { criadoEm: 'desc' },
            take: 100,
        });
    }
    async dashboard() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
        seteDiasAtras.setHours(0, 0, 0, 0);
        const [totalSessoes, sessoesHoje, totalMensagens, mensagensHoje, transicoesHoje, totalFluxos, fluxoAtivo, estadosMaisUsados, mensagensPorDia,] = await Promise.all([
            this.prisma.botEstadoUsuario.count(),
            this.prisma.botEstadoUsuario.count({ where: { atualizadoEm: { gte: hoje } } }),
            this.prisma.conversa.count(),
            this.prisma.conversa.count({ where: { criadoEm: { gte: hoje } } }),
            this.prisma.botEstadoHistorico.count({ where: { criadoEm: { gte: hoje } } }),
            this.prisma.botFluxo.count(),
            this.prisma.botFluxo.findFirst({ where: { ativo: true }, select: { id: true, nome: true } }),
            this.prisma.$queryRaw `
        SELECT estado_novo AS estado, COUNT(*)::int AS total
        FROM bot_estado_historico
        WHERE criado_em >= ${seteDiasAtras}
        GROUP BY estado_novo ORDER BY total DESC LIMIT 10
      `,
            this.prisma.$queryRaw `
        SELECT DATE(criado_em) AS dia, COUNT(*)::int AS total
        FROM conversa
        WHERE criado_em >= ${seteDiasAtras}
        GROUP BY DATE(criado_em) ORDER BY dia
      `,
        ]);
        return {
            totalSessoes,
            sessoesHoje,
            totalMensagens,
            mensagensHoje,
            transicoesHoje,
            totalFluxos,
            fluxoAtivo: fluxoAtivo || null,
            estadosMaisUsados,
            mensagensPorDia,
        };
    }
};
exports.MonitoringService = MonitoringService;
exports.MonitoringService = MonitoringService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MonitoringService);
//# sourceMappingURL=monitoring.service.js.map