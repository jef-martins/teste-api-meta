import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlowConverterService } from './flow-converter.service';

@Injectable()
export class FlowService {
  constructor(
    private prisma: PrismaService,
    private converter: FlowConverterService,
  ) {}

  private aplicarPrefixo(flowId: number, estados: any[], transicoes: any[]) {
    const prefix = `F${flowId}_`;
    const estadosPrefixados = estados.map((e: any) => ({ ...e, estado: prefix + e.estado }));
    const transicoesAtualizadas = transicoes.map((t: any) => ({
      ...t,
      estado_origem: prefix + t.estado_origem,
      estado_destino: prefix + t.estado_destino,
    }));
    return { estadosPrefixados, transicoesAtualizadas };
  }

  async listar(subOrganizacaoId?: number | null) {
    return this.prisma.botFluxo.findMany({
      where: subOrganizacaoId ? { subOrganizacaoId } : {},
      select: { id: true, nome: true, descricao: true, versao: true, ativo: true, subOrganizacaoId: true, criadoEm: true, atualizadoEm: true },
      orderBy: { atualizadoEm: 'desc' },
    });
  }

  async obter(id: number) {
    const fluxo = await this.prisma.botFluxo.findUnique({ where: { id } });
    if (!fluxo) throw new NotFoundException('Fluxo não encontrado');

    if (fluxo.flowJson) {
      return {
        id: fluxo.id,
        name: fluxo.nome,
        description: fluxo.descricao,
        version: fluxo.versao,
        ativo: fluxo.ativo,
        ...(fluxo.flowJson as object),
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

  async criar(data: { name: string; description?: string; nodes?: any[]; connections?: any[]; variables?: any[]; subOrganizacaoId?: number | null }) {
    if (!data.name) throw new BadRequestException('Nome é obrigatório');

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

  async atualizar(id: number, data: { name?: string; description?: string; nodes?: any[]; connections?: any[]; variables?: any[]; version?: number }) {
    const fluxoExistente = await this.prisma.botFluxo.findUnique({ where: { id } });
    if (!fluxoExistente) throw new NotFoundException('Fluxo não encontrado');

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

  async excluir(id: number) {
    // Remove user sessions pointing to this flow's states
    await this.prisma.botEstadoUsuario.deleteMany({
      where: { estado: { flowId: id } },
    });
    await this.prisma.botFluxo.delete({ where: { id } });
    return { ok: true };
  }

  async ativar(id: number) {
    const fluxo = await this.prisma.botFluxo.findUnique({ where: { id } });
    if (!fluxo) throw new NotFoundException('Fluxo não encontrado');

    await this.prisma.$transaction(async (tx) => {
      // Deactivate all states belonging to flows
      await tx.botEstadoConfig.updateMany({ where: { flowId: { not: null } }, data: { ativo: false } });

      // Deactivate all transitions from flow states
      await tx.$executeRaw`UPDATE bot_estado_transicao SET ativo = false WHERE estado_origem IN (SELECT estado FROM bot_estado_config WHERE flow_id IS NOT NULL)`;

      // Deactivate all flows
      await tx.botFluxo.updateMany({ data: { ativo: false } });

      // Activate this flow's states
      await tx.botEstadoConfig.updateMany({ where: { flowId: id }, data: { ativo: true } });

      // Activate transitions
      await tx.$executeRaw`UPDATE bot_estado_transicao SET ativo = true WHERE estado_origem IN (SELECT estado FROM bot_estado_config WHERE flow_id = ${id})`;

      // Activate the flow
      await tx.botFluxo.update({ where: { id }, data: { ativo: true } });

      // Find start state
      const startState = await tx.botEstadoConfig.findFirst({
        where: { flowId: id, nodeType: 'start' },
        select: { estado: true },
      });

      if (startState) {
        await tx.botEstadoUsuario.updateMany({ data: { estadoAtual: startState.estado } });
      } else {
        await tx.botEstadoUsuario.deleteMany();
      }
    });

    return { ok: true, mensagem: `Fluxo "${fluxo.nome}" ativado` };
  }

  // ─── Helpers privados ────────────────────────────────────────────────────

  private async limparEstados(flowId: number) {
    await this.prisma.botEstadoUsuario.deleteMany({
      where: { estado: { flowId } },
    });
    await this.prisma.botEstadoConfig.deleteMany({ where: { flowId } });
  }

  private async salvarEstados(flowId: number, estados: any[]) {
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

  private async salvarTransicoes(transicoes: any[]) {
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

  private async salvarVariaveis(flowId: number, variaveis: any[]) {
    await this.prisma.botFluxoVariavel.deleteMany({ where: { flowId } });
    for (const v of variaveis) {
      await this.prisma.botFluxoVariavel.create({
        data: { flowId, chave: v.key || v.chave, valorPadrao: v.value || v.valor_padrao || '' },
      });
    }
  }
}
