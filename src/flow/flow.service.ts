import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlowConverterService } from './flow-converter.service';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class FlowService {
  constructor(
    private prisma: PrismaService,
    private converter: FlowConverterService,
    private orgService: OrganizationService,
  ) {}

  private async obterNomeModificador(usuarioId: string): Promise<string | null> {
    const u = await this.prisma.botUsuario.findUnique({
      where: { id: usuarioId },
      select: { nome: true, email: true },
    });
    return u?.nome || u?.email || null;
  }

  private aplicarPrefixo(flowId: string, estados: any[], transicoes: any[]) {
    const prefix = `F${flowId}_`;
    const estadosPrefixados = estados.map((e: any) => ({
      ...e,
      estado: prefix + e.estado,
    }));
    const transicoesAtualizadas = transicoes.map((t: any) => ({
      ...t,
      estado_origem: prefix + t.estado_origem,
      estado_destino: prefix + t.estado_destino,
    }));
    return { estadosPrefixados, transicoesAtualizadas };
  }

  private async verificarAcessoFluxo(
    fluxo: any,
    usuarioId: string,
    isMaster = false,
  ) {
    if (isMaster) return;
    if (fluxo.subOrganizacaoId) {
      const temAcesso = await this.orgService.verificarAcessoSubOrg(
        usuarioId,
        fluxo.subOrganizacaoId,
      );
      if (!temAcesso) {
        throw new ForbiddenException('Sem acesso a este fluxo');
      }
    }
  }

  async listar(
    subOrganizacaoId: string | null,
    usuarioId: string,
    isMaster = false,
  ) {
    const subOrgsAcessiveis = await this.orgService.getSubOrgsAcessiveis(
      usuarioId,
      isMaster,
    );
    const idsAcessiveis = subOrgsAcessiveis.map((s) => s.id);

    const where = subOrganizacaoId
      ? isMaster || idsAcessiveis.includes(subOrganizacaoId)
        ? { subOrganizacaoId }
        : { id: '' } // sem acesso à sub-org solicitada
      : idsAcessiveis.length > 0
        ? { subOrganizacaoId: { in: idsAcessiveis } }
        : { id: '' };

    return this.prisma.botFluxo.findMany({
      where,
      select: {
        id: true,
        nome: true,
        descricao: true,
        versao: true,
        ativo: true,
        subOrganizacaoId: true,
        criadoEm: true,
        atualizadoEm: true,
        ultimoModificadorNome: true,
      },
      orderBy: { atualizadoEm: 'desc' },
    });
  }

  async obter(id: string, usuarioId: string, isMaster = false) {
    const fluxo = await this.prisma.botFluxo.findUnique({ where: { id } });
    if (!fluxo) throw new NotFoundException('Fluxo não encontrado');

    await this.verificarAcessoFluxo(fluxo, usuarioId, isMaster);

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

    const flowData = this.converter.stateMachineToFlow(
      estados,
      transicoes,
      variaveis,
    );

    return {
      id: fluxo.id,
      name: fluxo.nome,
      description: fluxo.descricao,
      version: fluxo.versao,
      ativo: fluxo.ativo,
      ...flowData,
    };
  }

  async criar(
    data: {
      name: string;
      description?: string;
      nodes?: any[];
      connections?: any[];
      variables?: any[];
      subOrganizacaoId?: string | null;
    },
    usuarioId?: string,
  ) {
    if (!data.name) throw new BadRequestException('Nome é obrigatório');

    const modificadorNome = usuarioId ? await this.obterNomeModificador(usuarioId) : null;

    const flowJson = {
      nodes: data.nodes,
      connections: data.connections,
      variables: data.variables,
    };

    const fluxo = await this.prisma.botFluxo.create({
      data: {
        nome: data.name,
        descricao: data.description || '',
        flowJson,
        subOrganizacaoId: data.subOrganizacaoId ?? null,
        ultimoModificadoPorId: usuarioId ?? null,
        ultimoModificadorNome: modificadorNome,
      },
    });

    const { estados, transicoes } = this.converter.flowToStateMachine(flowJson);
    const { estadosPrefixados, transicoesAtualizadas } = this.aplicarPrefixo(
      fluxo.id,
      estados,
      transicoes,
    );

    await this.salvarEstados(fluxo.id, estadosPrefixados);
    await this.salvarTransicoes(transicoesAtualizadas);

    if (data.variables?.length) {
      await this.salvarVariaveis(fluxo.id, data.variables);
    }

    return { ok: true, id: fluxo.id, fluxo };
  }

  async atualizar(
    id: string,
    data: {
      name?: string;
      description?: string;
      nodes?: any[];
      connections?: any[];
      variables?: any[];
      version?: number;
    },
    usuarioId: string,
    isMaster = false,
  ) {
    const fluxoExistente = await this.prisma.botFluxo.findUnique({
      where: { id },
    });
    if (!fluxoExistente) throw new NotFoundException('Fluxo não encontrado');

    await this.verificarAcessoFluxo(fluxoExistente, usuarioId, isMaster);

    const modificadorNome = await this.obterNomeModificador(usuarioId);

    const flowJson = {
      nodes: data.nodes,
      connections: data.connections,
      variables: data.variables,
    };

    await this.prisma.botFluxo.update({
      where: { id },
      data: {
        nome: data.name ?? fluxoExistente.nome,
        descricao: data.description ?? fluxoExistente.descricao,
        flowJson,
        versao: data.version || fluxoExistente.versao + 1,
        ultimoModificadoPorId: usuarioId,
        ultimoModificadorNome: modificadorNome,
      },
    });

    await this.limparEstados(id);

    const { estados, transicoes } = this.converter.flowToStateMachine(flowJson);
    const { estadosPrefixados, transicoesAtualizadas } = this.aplicarPrefixo(
      id,
      estados,
      transicoes,
    );

    await this.salvarEstados(id, estadosPrefixados);
    await this.salvarTransicoes(transicoesAtualizadas);

    if (data.variables) {
      await this.salvarVariaveis(id, data.variables);
    }

    return { ok: true };
  }

  async excluir(id: string, usuarioId: string, isMaster = false) {
    const fluxo = await this.prisma.botFluxo.findUnique({ where: { id } });
    if (!fluxo) throw new NotFoundException('Fluxo não encontrado');

    await this.verificarAcessoFluxo(fluxo, usuarioId, isMaster);

    // Remove user sessions pointing to this flow's states
    await this.prisma.botEstadoUsuario.deleteMany({
      where: { estado: { flowId: id } },
    });
    await this.prisma.botFluxo.delete({ where: { id } });
    return { ok: true };
  }

  async ativar(id: string, usuarioId: string, isMaster = false) {
    const fluxo = await this.prisma.botFluxo.findUnique({ where: { id } });
    if (!fluxo) throw new NotFoundException('Fluxo não encontrado');

    await this.verificarAcessoFluxo(fluxo, usuarioId, isMaster);

    await this.prisma.$transaction(async (tx) => {
      // Deactivate all states belonging to flows
      await tx.botEstadoConfig.updateMany({
        where: { flowId: { not: null } },
        data: { ativo: false },
      });

      // Deactivate all transitions from flow states
      await tx.$executeRaw`UPDATE bot_estado_transicao SET ativo = false WHERE estado_origem IN (SELECT estado FROM bot_estado_config WHERE flow_id IS NOT NULL)`;

      // Deactivate all flows
      await tx.botFluxo.updateMany({ data: { ativo: false } });

      // Activate this flow's states
      await tx.botEstadoConfig.updateMany({
        where: { flowId: id },
        data: { ativo: true },
      });

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
        await tx.botEstadoUsuario.updateMany({
          data: { estadoAtual: startState.estado },
        });
      } else {
        await tx.botEstadoUsuario.deleteMany();
      }
    });

    return { ok: true, mensagem: `Fluxo "${fluxo.nome}" ativado` };
  }

  // ─── Compilação pública (usada pelo CollaborationService) ─────────────────

  async recompilarFluxo(flowId: string, flowJson: any) {
    const { estados, transicoes } = this.converter.flowToStateMachine(flowJson);
    const { estadosPrefixados, transicoesAtualizadas } = this.aplicarPrefixo(
      flowId,
      estados,
      transicoes,
    );
    await this.limparEstados(flowId);
    await this.salvarEstados(flowId, estadosPrefixados);
    await this.salvarTransicoes(transicoesAtualizadas);
    if (flowJson.variables?.length) {
      await this.salvarVariaveis(flowId, flowJson.variables);
    }
  }

  // ─── Helpers privados ────────────────────────────────────────────────────

  private async limparEstados(flowId: string) {
    await this.prisma.botEstadoUsuario.deleteMany({
      where: { estado: { flowId } },
    });
    await this.prisma.botEstadoConfig.deleteMany({ where: { flowId } });
  }

  private async salvarEstados(flowId: string, estados: any[]) {
    if (!estados.length) return;
    await this.prisma.botEstadoConfig.createMany({
      data: estados.map((e) => ({
        estado: e.estado,
        handler: e.handler,
        descricao: e.descricao || '',
        ativo: e.ativo !== false,
        config: e.config || {},
        nodeId: e.node_id || null,
        nodeType: e.node_type || null,
        position: e.position || { x: 0, y: 0 },
        flowId,
      })),
    });
  }

  private async salvarTransicoes(transicoes: any[]) {
    if (!transicoes.length) return;
    await this.prisma.botEstadoTransicao.createMany({
      data: transicoes.map((t) => ({
        estadoOrigem: t.estado_origem,
        entrada: t.entrada,
        estadoDestino: t.estado_destino,
        ativo: t.ativo !== false,
      })),
    });
  }

  private async salvarVariaveis(flowId: string, variaveis: any[]) {
    await this.prisma.botFluxoVariavel.deleteMany({ where: { flowId } });
    if (!variaveis.length) return;
    await this.prisma.botFluxoVariavel.createMany({
      data: variaveis.map((v) => ({
        flowId,
        chave: v.key || v.chave,
        valorPadrao: v.value || v.valor_padrao || '',
      })),
    });
  }
}
