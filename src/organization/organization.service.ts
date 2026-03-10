import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  // ─── Sub-orgs acessíveis pelo usuário ────────────────────────────────────

  async getSubOrgsAcessiveis(usuarioId: string) {
    // Via membro direto da organização (herda todas sub-orgs)
    const orgMembros = await this.prisma.orgMembro.findMany({
      where: { usuarioId },
      select: { organizacaoId: true },
    });
    const orgIds = orgMembros.map((o) => o.organizacaoId);

    const viaOrg =
      orgIds.length > 0
        ? await this.prisma.subOrganizacao.findMany({
            where: { organizacaoId: { in: orgIds }, ativa: true },
            include: {
              organizacao: { select: { id: true, nome: true, slug: true } },
            },
          })
        : [];

    // Via membro direto da sub-org
    const subOrgMembros = await this.prisma.subOrgMembro.findMany({
      where: { usuarioId },
      include: {
        subOrganizacao: {
          include: {
            organizacao: { select: { id: true, nome: true, slug: true } },
          },
        },
      },
    });

    const todas = new Map<string, any>();
    for (const s of viaOrg) todas.set(s.id, s);
    for (const m of subOrgMembros) {
      if (m.subOrganizacao && m.subOrganizacao.ativa) {
        todas.set(m.subOrganizacao.id, m.subOrganizacao);
      }
    }

    return Array.from(todas.values());
  }

  async verificarAcessoSubOrg(
    usuarioId: string,
    subOrgId: string,
  ): Promise<boolean> {
    const acessiveis = await this.getSubOrgsAcessiveis(usuarioId);
    return acessiveis.some((s) => s.id === subOrgId);
  }

  // ─── Organizações do usuário ──────────────────────────────────────────────

  async listarOrganizacoes(usuarioId: string) {
    const membros = await this.prisma.orgMembro.findMany({
      where: { usuarioId },
      include: {
        organizacao: {
          include: {
            subOrganizacoes: {
              where: { ativa: true },
              select: { id: true, nome: true, slug: true },
            },
            _count: { select: { membros: true } },
          },
        },
      },
    });

    return membros.map((m) => ({
      ...m.organizacao,
      papel: m.papel,
    }));
  }

  async criarOrganizacao(
    usuarioId: string,
    data: { nome: string; slug?: string },
  ) {
    if (!data.nome) throw new BadRequestException('Nome é obrigatório');

    let slug = data.slug || this.gerarSlug(data.nome);

    // Garante slug único acrescentando sufixo numérico se necessário
    const slugBase = slug;
    let tentativa = 0;
    while (true) {
      const existe = await this.prisma.organizacao.findUnique({
        where: { slug },
      });
      if (!existe) break;
      tentativa++;
      slug = `${slugBase}-${tentativa}`;
    }

    const org = await this.prisma.organizacao.create({
      data: { nome: data.nome, slug },
    });

    // Criador vira "dono"
    await this.prisma.orgMembro.create({
      data: { organizacaoId: org.id, usuarioId, papel: 'dono' },
    });

    return org;
  }

  async obterOrganizacao(orgId: string, usuarioId: string) {
    await this.verificarMembroOrg(orgId, usuarioId);
    return this.prisma.organizacao.findUnique({
      where: { id: orgId },
      include: {
        subOrganizacoes: { where: { ativa: true } },
        membros: {
          include: {
            usuario: { select: { id: true, email: true, nome: true } },
          },
        },
      },
    });
  }

  async atualizarOrganizacao(
    orgId: string,
    usuarioId: string,
    data: { nome?: string },
  ) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin']);
    return this.prisma.organizacao.update({ where: { id: orgId }, data });
  }

  async excluirOrganizacao(orgId: string, usuarioId: string) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono']);
    await this.prisma.organizacao.delete({ where: { id: orgId } });
    return { ok: true };
  }

  // ─── Membros da organização ───────────────────────────────────────────────

  async listarMembros(orgId: string, usuarioId: string) {
    await this.verificarMembroOrg(orgId, usuarioId);
    return this.prisma.orgMembro.findMany({
      where: { organizacaoId: orgId },
      include: { usuario: { select: { id: true, email: true, nome: true } } },
    });
  }

  async adicionarMembro(
    orgId: string,
    solicitanteId: string,
    emailConvidado: string,
    papel = 'membro',
  ) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin']);

    const usuario = await this.prisma.botUsuario.findUnique({
      where: { email: emailConvidado },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const jaExiste = await this.prisma.orgMembro.findUnique({
      where: {
        organizacaoId_usuarioId: {
          organizacaoId: orgId,
          usuarioId: usuario.id,
        },
      },
    });
    if (jaExiste)
      throw new BadRequestException('Usuário já é membro desta organização');

    return this.prisma.orgMembro.create({
      data: { organizacaoId: orgId, usuarioId: usuario.id, papel },
    });
  }

  async removerMembro(orgId: string, solicitanteId: string, membroId: string) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin']);
    await this.prisma.orgMembro.delete({
      where: {
        organizacaoId_usuarioId: { organizacaoId: orgId, usuarioId: membroId },
      },
    });
    return { ok: true };
  }

  // ─── Sub-organizações ─────────────────────────────────────────────────────

  async listarSubOrgs(orgId: string, usuarioId: string) {
    await this.verificarMembroOrg(orgId, usuarioId);
    return this.prisma.subOrganizacao.findMany({
      where: { organizacaoId: orgId },
      include: {
        _count: { select: { membros: true, fluxos: true } },
      },
    });
  }

  async criarSubOrg(
    orgId: string,
    usuarioId: string,
    data: { nome: string; slug?: string },
  ) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin']);
    if (!data.nome) throw new BadRequestException('Nome é obrigatório');

    let slug = data.slug || this.gerarSlug(data.nome);

    // Garante slug único dentro da organização
    const slugBase = slug;
    let tentativa = 0;
    while (true) {
      const existe = await this.prisma.subOrganizacao.findUnique({
        where: { organizacaoId_slug: { organizacaoId: orgId, slug } },
      });
      if (!existe) break;
      tentativa++;
      slug = `${slugBase}-${tentativa}`;
    }

    return this.prisma.subOrganizacao.create({
      data: { organizacaoId: orgId, nome: data.nome, slug },
    });
  }

  async atualizarSubOrg(
    orgId: string,
    subOrgId: string,
    usuarioId: string,
    data: { nome?: string },
  ) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin']);
    return this.prisma.subOrganizacao.update({ where: { id: subOrgId }, data });
  }

  async excluirSubOrg(orgId: string, subOrgId: string, usuarioId: string) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin']);
    await this.prisma.subOrganizacao.delete({ where: { id: subOrgId } });
    return { ok: true };
  }

  async transferirSubOrg(
    subOrgId: string,
    novaOrgId: string,
    usuarioId: string,
  ) {
    const subOrg = await this.prisma.subOrganizacao.findUnique({
      where: { id: subOrgId },
    });
    if (!subOrg) throw new NotFoundException('Sub-organização não encontrada');

    await this.verificarPapelOrg(subOrg.organizacaoId, usuarioId, [
      'dono',
      'admin',
    ]);
    await this.verificarPapelOrg(novaOrgId, usuarioId, ['dono', 'admin']);

    const slug = subOrg.slug;
    const conflito = await this.prisma.subOrganizacao.findUnique({
      where: { organizacaoId_slug: { organizacaoId: novaOrgId, slug } },
    });
    const novoSlug = conflito ? `${slug}-${Date.now()}` : slug;

    return this.prisma.subOrganizacao.update({
      where: { id: subOrgId },
      data: { organizacaoId: novaOrgId, slug: novoSlug },
    });
  }

  // ─── Membros da sub-organização ───────────────────────────────────────────

  async adicionarMembroSubOrg(
    orgId: string,
    subOrgId: string,
    solicitanteId: string,
    emailConvidado: string,
    papel = 'membro',
  ) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin']);

    const usuario = await this.prisma.botUsuario.findUnique({
      where: { email: emailConvidado },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const jaExiste = await this.prisma.subOrgMembro.findUnique({
      where: {
        subOrganizacaoId_usuarioId: {
          subOrganizacaoId: subOrgId,
          usuarioId: usuario.id,
        },
      },
    });
    if (jaExiste)
      throw new BadRequestException(
        'Usuário já é membro desta sub-organização',
      );

    return this.prisma.subOrgMembro.create({
      data: { subOrganizacaoId: subOrgId, usuarioId: usuario.id, papel },
    });
  }

  async removerMembroSubOrg(
    orgId: string,
    subOrgId: string,
    solicitanteId: string,
    membroId: string,
  ) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin']);
    await this.prisma.subOrgMembro.delete({
      where: {
        subOrganizacaoId_usuarioId: {
          subOrganizacaoId: subOrgId,
          usuarioId: membroId,
        },
      },
    });
    return { ok: true };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private async verificarMembroOrg(orgId: string, usuarioId: string) {
    const membro = await this.prisma.orgMembro.findUnique({
      where: { organizacaoId_usuarioId: { organizacaoId: orgId, usuarioId } },
    });
    if (!membro) throw new ForbiddenException('Sem acesso a esta organização');
  }

  private async verificarPapelOrg(
    orgId: string,
    usuarioId: string,
    papeisPermitidos: string[],
  ) {
    const membro = await this.prisma.orgMembro.findUnique({
      where: { organizacaoId_usuarioId: { organizacaoId: orgId, usuarioId } },
    });
    if (!membro || !papeisPermitidos.includes(membro.papel)) {
      throw new ForbiddenException('Permissão insuficiente');
    }
  }

  private gerarSlug(nome: string): string {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }
}
