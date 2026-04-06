import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from '../organization/organization.service';
import { FlowService } from '../flow/flow.service';
import { CollaborationService } from '../collaboration/collaboration.service';
import { FlowNode, FlowConnection } from '../flow/flow-converter.service';

@Injectable()
export class CustomComponentService {
  private readonly logger = new Logger(CustomComponentService.name);

  constructor(
    private prisma: PrismaService,
    private orgService: OrganizationService,
    private flowService: FlowService,
    private collaborationService: CollaborationService,
  ) { }

  private async verificarAcessoSubOrg(
    usuarioId: string,
    subOrgId: string | null,
  ) {
    if (!subOrgId) return;
    const temAcesso = await this.orgService.verificarAcessoSubOrg(
      usuarioId,
      subOrgId,
    );
    if (!temAcesso)
      throw new ForbiddenException('Sem acesso a esta sub-organização');
  }

  async listar(usuarioId: string, subOrgId: string | null) {
    if (!subOrgId) return [];
    await this.verificarAcessoSubOrg(usuarioId, subOrgId);

    return this.prisma.componentePersonalizado.findMany({
      where: { subOrganizacaoId: subOrgId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async obter(id: string, usuarioId: string) {
    const comp = await this.prisma.componentePersonalizado.findUnique({
      where: { id },
      include: {
        subOrganizacao: {
          select: { id: true, collabEnabled: true, collabDisabledByMaster: true },
        },
      },
    });
    if (!comp) throw new NotFoundException('Componente não encontrado');
    await this.verificarAcessoSubOrg(usuarioId, comp.subOrganizacaoId);

    const collabInfo = comp.subOrganizacao
      ? {
        collabEnabled: comp.subOrganizacao.collabEnabled,
        collabDisabledByMaster: comp.subOrganizacao.collabDisabledByMaster,
      }
      : null;

    return { ...comp, collabInfo };
  }

  async criar(
    usuarioId: string,
    subOrgId: string | null,
    data: {
      nome: string;
      descricao?: string;
      icone?: string;
      nodesJson: object;
    },
  ) {
    if (!data.nome) throw new BadRequestException('Nome é obrigatório');
    if (!data.nodesJson)
      throw new BadRequestException('nodesJson é obrigatório');
    await this.verificarAcessoSubOrg(usuarioId, subOrgId);

    return this.prisma.componentePersonalizado.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        icone: data.icone || 'package',
        nodesJson: data.nodesJson,
        subOrganizacaoId: subOrgId,
      },
    });
  }

  async atualizar(
    id: string,
    usuarioId: string,
    data: {
      nome?: string;
      descricao?: string;
      icone?: string;
      nodesJson?: object;
    },
  ) {
    const comp = await this.prisma.componentePersonalizado.findUnique({
      where: { id },
    });
    if (!comp) throw new NotFoundException('Componente não encontrado');
    await this.verificarAcessoSubOrg(usuarioId, comp.subOrganizacaoId);

    const updated = await this.prisma.componentePersonalizado.update({
      where: { id },
      data,
    });

    // Propagar alterações do nodesJson para todos os fluxos que usam este componente
    if (data.nodesJson) {
      try {
        const nodesJsonTyped = data.nodesJson as { nodes?: unknown[]; connections?: unknown[] };
        const result = await this.flowService.atualizarNosDoComponente(id, {
          nodes: (nodesJsonTyped.nodes as FlowNode[]) || [],
          connections: (nodesJsonTyped.connections as FlowConnection[]) || [],
        });

        await this.collaborationService.forceUpdateComponentInAllFlows(
          id,
          {
            nodes: (nodesJsonTyped.nodes as FlowNode[]) || [],
            connections: (nodesJsonTyped.connections as FlowConnection[]) || [],
          },
          result.flowIds,
        );
        this.logger.log(
          `Componente ${id} atualizado — ${result.fluxosAtualizados} fluxo(s) recompilado(s) e Yjs sincronizados`,
        );
      } catch (err) {
        this.logger.error(`Falha ao propagar atualização do componente ${id} para fluxos`, err);
      }
    }

    return updated;
  }

  async excluir(id: string, usuarioId: string) {
    const comp = await this.prisma.componentePersonalizado.findUnique({
      where: { id },
    });
    if (!comp) throw new NotFoundException('Componente não encontrado');
    await this.verificarAcessoSubOrg(usuarioId, comp.subOrganizacaoId);

    await this.prisma.componentePersonalizado.delete({ where: { id } });
    return { ok: true };
  }
}
