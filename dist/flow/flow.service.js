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
exports.FlowService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const flow_converter_service_1 = require("./flow-converter.service");
const organization_service_1 = require("../organization/organization.service");
let FlowService = class FlowService {
    prisma;
    converter;
    orgService;
    constructor(prisma, converter, orgService) {
        this.prisma = prisma;
        this.converter = converter;
        this.orgService = orgService;
    }
    aplicarPrefixo(flowId, estados, transicoes) {
        const prefix = `F${flowId}_`;
        const estadosPrefixados = estados.map((e) => ({ ...e, estado: prefix + e.estado }));
        const transicoesAtualizadas = transicoes.map((t) => ({
            ...t,
            estado_origem: prefix + t.estado_origem,
            estado_destino: prefix + t.estado_destino,
        }));
        return { estadosPrefixados, transicoesAtualizadas };
    }
    async verificarAcessoFluxo(fluxo, usuarioId) {
        if (fluxo.subOrganizacaoId) {
            const temAcesso = await this.orgService.verificarAcessoSubOrg(usuarioId, fluxo.subOrganizacaoId);
            if (!temAcesso) {
                throw new common_1.ForbiddenException('Sem acesso a este fluxo');
            }
        }
    }
    async listar(subOrganizacaoId, usuarioId) {
        const subOrgsAcessiveis = await this.orgService.getSubOrgsAcessiveis(usuarioId);
        const idsAcessiveis = subOrgsAcessiveis.map((s) => s.id);
        const where = subOrganizacaoId
            ? idsAcessiveis.includes(subOrganizacaoId) ? { subOrganizacaoId } : { id: '' }
            : idsAcessiveis.length > 0 ? { subOrganizacaoId: { in: idsAcessiveis } } : { id: '' };
        return this.prisma.botFluxo.findMany({
            where,
            select: { id: true, nome: true, descricao: true, versao: true, ativo: true, subOrganizacaoId: true, criadoEm: true, atualizadoEm: true },
            orderBy: { atualizadoEm: 'desc' },
        });
    }
    async obter(id, usuarioId) {
        const fluxo = await this.prisma.botFluxo.findUnique({ where: { id } });
        if (!fluxo)
            throw new common_1.NotFoundException('Fluxo não encontrado');
        await this.verificarAcessoFluxo(fluxo, usuarioId);
        if (fluxo.flowJson) {
            return {
                id: fluxo.id,
                name: fluxo.nome,
                description: fluxo.descricao,
                version: fluxo.versao,
                ativo: fluxo.ativo,
                ...fluxo.flowJson,
            };
        }
        const estados = await this.prisma.botEstadoConfig.findMany({
            where: { flowId: id },
            orderBy: { estado: 'asc' },
        });
        const transicoes = await this.prisma.botEstadoTransicao.findMany({
            where: { origem: { flowId: id } },
            orderBy: [{ estadoOrigem: 'asc' }, { entrada: 'asc' }],
        });
        const variaveis = await this.prisma.botFluxoVariavel.findMany({
            where: { flowId: id },
            orderBy: { chave: 'asc' },
        });
        const flowData = this.converter.stateMachineToFlow(estados, transicoes, variaveis);
        return {
            id: fluxo.id,
            name: fluxo.nome,
            description: fluxo.descricao,
            version: fluxo.versao,
            ativo: fluxo.ativo,
            ...flowData,
        };
    }
    async criar(data) {
        if (!data.name)
            throw new common_1.BadRequestException('Nome é obrigatório');
        const flowJson = { nodes: data.nodes, connections: data.connections, variables: data.variables };
        const fluxo = await this.prisma.botFluxo.create({
            data: {
                nome: data.name,
                descricao: data.description || '',
                flowJson,
                subOrganizacaoId: data.subOrganizacaoId ?? null,
            },
        });
        const { estados, transicoes, variaveis } = this.converter.flowToStateMachine(flowJson);
        const { estadosPrefixados, transicoesAtualizadas } = this.aplicarPrefixo(fluxo.id, estados, transicoes);
        await this.salvarEstados(fluxo.id, estadosPrefixados);
        await this.salvarTransicoes(transicoesAtualizadas);
        if (data.variables?.length) {
            await this.salvarVariaveis(fluxo.id, data.variables);
        }
        return { ok: true, id: fluxo.id, fluxo };
    }
    async atualizar(id, data, usuarioId) {
        const fluxoExistente = await this.prisma.botFluxo.findUnique({ where: { id } });
        if (!fluxoExistente)
            throw new common_1.NotFoundException('Fluxo não encontrado');
        await this.verificarAcessoFluxo(fluxoExistente, usuarioId);
        const flowJson = { nodes: data.nodes, connections: data.connections, variables: data.variables };
        await this.prisma.botFluxo.update({
            where: { id },
            data: {
                nome: data.name ?? fluxoExistente.nome,
                descricao: data.description ?? fluxoExistente.descricao,
                flowJson,
                versao: data.version || fluxoExistente.versao + 1,
            },
        });
        await this.limparEstados(id);
        const { estados, transicoes } = this.converter.flowToStateMachine(flowJson);
        const { estadosPrefixados, transicoesAtualizadas } = this.aplicarPrefixo(id, estados, transicoes);
        await this.salvarEstados(id, estadosPrefixados);
        await this.salvarTransicoes(transicoesAtualizadas);
        if (data.variables) {
            await this.salvarVariaveis(id, data.variables);
        }
        return { ok: true };
    }
    async excluir(id, usuarioId) {
        const fluxo = await this.prisma.botFluxo.findUnique({ where: { id } });
        if (!fluxo)
            throw new common_1.NotFoundException('Fluxo não encontrado');
        await this.verificarAcessoFluxo(fluxo, usuarioId);
        await this.prisma.botEstadoUsuario.deleteMany({
            where: { estado: { flowId: id } },
        });
        await this.prisma.botFluxo.delete({ where: { id } });
        return { ok: true };
    }
    async ativar(id, usuarioId) {
        const fluxo = await this.prisma.botFluxo.findUnique({ where: { id } });
        if (!fluxo)
            throw new common_1.NotFoundException('Fluxo não encontrado');
        await this.verificarAcessoFluxo(fluxo, usuarioId);
        await this.prisma.$transaction(async (tx) => {
            await tx.botEstadoConfig.updateMany({ where: { flowId: { not: null } }, data: { ativo: false } });
            await tx.$executeRaw `UPDATE bot_estado_transicao SET ativo = false WHERE estado_origem IN (SELECT estado FROM bot_estado_config WHERE flow_id IS NOT NULL)`;
            await tx.botFluxo.updateMany({ data: { ativo: false } });
            await tx.botEstadoConfig.updateMany({ where: { flowId: id }, data: { ativo: true } });
            await tx.$executeRaw `UPDATE bot_estado_transicao SET ativo = true WHERE estado_origem IN (SELECT estado FROM bot_estado_config WHERE flow_id = ${id})`;
            await tx.botFluxo.update({ where: { id }, data: { ativo: true } });
            const startState = await tx.botEstadoConfig.findFirst({
                where: { flowId: id, nodeType: 'start' },
                select: { estado: true },
            });
            if (startState) {
                await tx.botEstadoUsuario.updateMany({ data: { estadoAtual: startState.estado } });
            }
            else {
                await tx.botEstadoUsuario.deleteMany();
            }
        });
        return { ok: true, mensagem: `Fluxo "${fluxo.nome}" ativado` };
    }
    async limparEstados(flowId) {
        await this.prisma.botEstadoUsuario.deleteMany({
            where: { estado: { flowId } },
        });
        await this.prisma.botEstadoConfig.deleteMany({ where: { flowId } });
    }
    async salvarEstados(flowId, estados) {
        for (const e of estados) {
            await this.prisma.botEstadoConfig.create({
                data: {
                    estado: e.estado,
                    handler: e.handler,
                    descricao: e.descricao || '',
                    ativo: e.ativo !== false,
                    config: e.config || {},
                    nodeId: e.node_id || null,
                    nodeType: e.node_type || null,
                    position: e.position || { x: 0, y: 0 },
                    flowId,
                },
            });
        }
    }
    async salvarTransicoes(transicoes) {
        for (const t of transicoes) {
            await this.prisma.botEstadoTransicao.create({
                data: {
                    estadoOrigem: t.estado_origem,
                    entrada: t.entrada,
                    estadoDestino: t.estado_destino,
                    ativo: t.ativo !== false,
                },
            });
        }
    }
    async salvarVariaveis(flowId, variaveis) {
        await this.prisma.botFluxoVariavel.deleteMany({ where: { flowId } });
        for (const v of variaveis) {
            await this.prisma.botFluxoVariavel.create({
                data: { flowId, chave: v.key || v.chave, valorPadrao: v.value || v.valor_padrao || '' },
            });
        }
    }
};
exports.FlowService = FlowService;
exports.FlowService = FlowService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        flow_converter_service_1.FlowConverterService,
        organization_service_1.OrganizationService])
], FlowService);
//# sourceMappingURL=flow.service.js.map