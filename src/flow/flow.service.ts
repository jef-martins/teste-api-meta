import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FlowConnection,
  FlowConverterService,
  FlowJsonPayload,
  FlowNode,
  FlowVariable,
  EstadoConfigOutput,
  TransicaoOutput,
} from './flow-converter.service';
import { OrganizationService } from '../organization/organization.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
type FlowCreateData = {
  name: string;
  description?: string;
  nodes?: FlowNode[];
  connections?: FlowConnection[];
  variables?: FlowVariable[];
  subOrganizacaoId?: string | null;
};

type FlowUpdateData = {
  name?: string;
  description?: string;
  nodes?: FlowNode[];
  connections?: FlowConnection[];
  variables?: FlowVariable[];
  version?: number;
};

type FlowAccessInfo = {
  subOrganizacaoId: string | null;
};

type EstadoDb = {
  estado: string;
  handler: string;
  descricao: string | null;
  ativo: boolean;
  config: Prisma.JsonValue;
  nodeId: string | null;
  nodeType: string | null;
  position: Prisma.JsonValue | null;
};

type TransicaoDb = {
  estadoOrigem: string;
  entrada: string;
  estadoDestino: string;
  ativo: boolean;
};

type VariavelDb = {
  chave: string;
  valorPadrao: string | null;
};

@Injectable()
export class FlowService {
  constructor(
    private prisma: PrismaService,
    private converter: FlowConverterService,
    private orgService: OrganizationService,
    private eventEmitter: EventEmitter2,
  ) {}

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private toFlowJsonPayload(data: {
    nodes?: FlowNode[];
    connections?: FlowConnection[];
    variables?: FlowVariable[];
  }): FlowJsonPayload {
    const flowJson: FlowJsonPayload = {};

    if (data.nodes) flowJson.nodes = data.nodes;
    if (data.connections) flowJson.connections = data.connections;
    if (data.variables) flowJson.variables = data.variables;

    return flowJson;
  }

  private parsePosition(position: Prisma.JsonValue | null): { x: number; y: number } {
    if (!this.isObject(position)) return { x: 0, y: 0 };
    const x = typeof position.x === "number" ? position.x : 0;
    const y = typeof position.y === "number" ? position.y : 0;
    return { x, y };
  }

  private parseConfig(config: Prisma.JsonValue): Record<string, unknown> {
    if (!this.isObject(config)) return {};
    return config;
  }

  private mapEstadoDbToOutput(estado: EstadoDb): EstadoConfigOutput {
    return {
      estado: estado.estado,
      handler: estado.handler,
      descricao: estado.descricao || "",
      ativo: estado.ativo !== false,
      config: this.parseConfig(estado.config),
      node_id: estado.nodeId || estado.estado,
      node_type: estado.nodeType || "message",
      position: this.parsePosition(estado.position),
    };
  }

  private mapTransicaoDbToOutput(transicao: TransicaoDb): TransicaoOutput {
    return {
      estado_origem: transicao.estadoOrigem,
      entrada: transicao.entrada,
      estado_destino: transicao.estadoDestino,
      ativo: transicao.ativo !== false,
    };
  }

  private mapVariavelDbToOutput(variavel: VariavelDb): FlowVariable {
    return {
      chave: variavel.chave,
      valor_padrao: variavel.valorPadrao || "",
    };
  }

  private async obterNomeModificador(
    usuarioId: string,
  ): Promise<string | null> {
    const u = await this.prisma.botUsuario.findUnique({
      where: { id: usuarioId },
      select: { nome: true, email: true },
    });
    return u?.nome || u?.email || null;
  }

  private aplicarPrefixo(
    flowId: string,
    estados: EstadoConfigOutput[],
    transicoes: TransicaoOutput[],
  ) {
    const prefix = `F${flowId}_`;
    const estadosPrefixados = estados.map((e) => ({
      ...e,
      estado: prefix + e.estado,
    }));
    const transicoesAtualizadas = transicoes.map((t) => ({
      ...t,
      estado_origem: prefix + t.estado_origem,
      estado_destino: prefix + t.estado_destino,
    }));
    return { estadosPrefixados, transicoesAtualizadas };
  }

  private async verificarAcessoFluxo(
    fluxo: FlowAccessInfo,
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
      estados.map((estado) => this.mapEstadoDbToOutput(estado as EstadoDb)),
      transicoes.map((transicao) =>
        this.mapTransicaoDbToOutput(transicao as TransicaoDb),
      ),
      variaveis.map((variavel) =>
        this.mapVariavelDbToOutput(variavel as VariavelDb),
      ),
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

  async criar(data: FlowCreateData, usuarioId?: string) {
    if (!data.name) throw new BadRequestException('Nome é obrigatório');

    const modificadorNome = usuarioId
      ? await this.obterNomeModificador(usuarioId)
      : null;

    const flowJson = this.toFlowJsonPayload(data);

    const fluxo = await this.prisma.botFluxo.create({
      data: {
        nome: data.name,
        descricao: data.description || '',
        flowJson: flowJson as Prisma.InputJsonValue,
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

    await this.persistirEstados(
      fluxo.id,
      estadosPrefixados,
      transicoesAtualizadas,
    );

    if (data.variables?.length) {
      await this.salvarVariaveis(fluxo.id, data.variables);
    }

    this.eventEmitter.emit('flow.updated');
    return { ok: true, id: fluxo.id, fluxo };
  }

  async atualizar(
    id: string,
    data: FlowUpdateData,
    usuarioId: string,
    isMaster = false,
  ) {
    const fluxoExistente = await this.prisma.botFluxo.findUnique({
      where: { id },
    });
    if (!fluxoExistente) throw new NotFoundException('Fluxo não encontrado');

    await this.verificarAcessoFluxo(fluxoExistente, usuarioId, isMaster);

    const modificadorNome = await this.obterNomeModificador(usuarioId);

    const flowJson = this.toFlowJsonPayload(data);

    await this.prisma.botFluxo.update({
      where: { id },
      data: {
        nome: data.name ?? fluxoExistente.nome,
        descricao: data.description ?? fluxoExistente.descricao,
        flowJson: flowJson as Prisma.InputJsonValue,
        versao: data.version || fluxoExistente.versao + 1,
        ultimoModificadoPorId: usuarioId,
        ultimoModificadorNome: modificadorNome,
      },
    });

    const { estados, transicoes } = this.converter.flowToStateMachine(flowJson);
    const { estadosPrefixados, transicoesAtualizadas } = this.aplicarPrefixo(
      id,
      estados,
      transicoes,
    );

    await this.persistirEstados(id, estadosPrefixados, transicoesAtualizadas);

    if (data.variables) {
      await this.salvarVariaveis(id, data.variables);
    }

    this.eventEmitter.emit('flow.updated');
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

    this.eventEmitter.emit('flow.updated');
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

    this.eventEmitter.emit('flow.updated');
    return { ok: true, mensagem: `Fluxo "${fluxo.nome}" ativado` };
  }

  // ─── Compilação pública (usada pelo CollaborationService) ─────────────────

  async recompilarFluxo(flowId: string, flowJson: FlowJsonPayload) {
    const { estados, transicoes } = this.converter.flowToStateMachine(flowJson);
    const { estadosPrefixados, transicoesAtualizadas } = this.aplicarPrefixo(
      flowId,
      estados,
      transicoes,
    );
    await this.persistirEstados(
      flowId,
      estadosPrefixados,
      transicoesAtualizadas,
    );
    if (flowJson.variables?.length) {
      await this.salvarVariaveis(flowId, flowJson.variables);
    }
  }

  // ─── Helpers privados ────────────────────────────────────────────────────

  /**
   * Apaga e recria os estados/transições de um fluxo dentro de uma única
   * transação, evitando race condition entre atualizar() e recompilarFluxo().
   */
  private async persistirEstados(
    flowId: string,
    estados: EstadoConfigOutput[],
    transicoes: TransicaoOutput[],
  ) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Apagar usuários cujo estado pertence a este fluxo (FK constraint)
      await tx.botEstadoUsuario.deleteMany({
        where: { estado: { flowId } },
      });
      // 2. Apagar configs (cascade apaga também botEstadoTransicao)
      await tx.botEstadoConfig.deleteMany({ where: { flowId } });

      // 3. Criar novos estados
      if (estados.length) {
        await tx.botEstadoConfig.createMany({
          data: estados.map((e) => ({
            estado: e.estado,
            handler: e.handler,
            descricao: e.descricao || '',
            ativo: e.ativo !== false,
            config: (e.config || {}) as Prisma.InputJsonValue,
            nodeId: e.node_id || null,
            nodeType: e.node_type || null,
            position: e.position || { x: 0, y: 0 },
            flowId,
          })),
        });
      }

      // 4. Criar novas transições (estados já existem no mesmo tx)
      if (transicoes.length) {
        await tx.botEstadoTransicao.createMany({
          data: transicoes.map((t) => ({
            estadoOrigem: t.estado_origem,
            entrada: t.entrada,
            estadoDestino: t.estado_destino,
            ativo: t.ativo !== false,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  private async salvarVariaveis(flowId: string, variaveis: FlowVariable[]) {
    await this.prisma.botFluxoVariavel.deleteMany({ where: { flowId } });

    const data = variaveis
      .map((v) => {
        const chave = (v.key || v.chave || '').trim();
        if (!chave) return null;

        return {
          flowId,
          chave,
          valorPadrao: v.value || v.valor_padrao || '',
        };
      })
      .filter(
        (item): item is { flowId: string; chave: string; valorPadrao: string } =>
          item !== null,
      );

    if (!data.length) return;

    await this.prisma.botFluxoVariavel.createMany({ data });
  }
}
