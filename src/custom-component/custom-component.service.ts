import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class CustomComponentService {
  constructor(
    private prisma: PrismaService,
    private orgService: OrganizationService,
  ) {}

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

    return this.prisma.componentePersonalizado.update({
      where: { id },
      data,
    });
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
