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

  async getSubOrgsAcessiveis(usuarioId: string, isMaster = false) {
    if (isMaster) {
      return this.prisma.subOrganizacao.findMany({
        where: { ativa: true },
        include: {
          organizacao: { select: { id: true, nome: true, slug: true } },
        },
      });
    }
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
    isMaster = false,
  ): Promise<boolean> {
    if (isMaster) return true;
    const acessiveis = await this.getSubOrgsAcessiveis(usuarioId);
    return acessiveis.some((s) => s.id === subOrgId);
  }

  // ─── Organizações do usuário ──────────────────────────────────────────────

  async listarOrganizacoes(
    usuarioId: string,
    isMaster = false,
    papel = 'user',
  ) {
    if (isMaster) {
      const orgs = await this.prisma.organizacao.findMany({
        include: {
          subOrganizacoes: {
            where: { ativa: true },
            select: { id: true, nome: true, slug: true },
          },
          _count: { select: { membros: true } },
        },
      });
      return orgs.map((org) => ({ ...org, papel: 'master' }));
    }

    // Usuário admin: vê todas as orgs que pertence com todas as sub-orgs
    if (papel === 'admin') {
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
      return membros.map((m) => ({ ...m.organizacao, papel: m.papel }));
    }

    // Usuário comum: vê apenas as sub-orgs que pertence, agrupadas por org-pai
    const subOrgMembros = await this.prisma.subOrgMembro.findMany({
      where: { usuarioId },
      include: {
        subOrganizacao: {
          include: {
            organizacao: {
              include: { _count: { select: { membros: true } } },
            },
          },
        },
      },
    });

    const resultado = new Map<string, any>();
    for (const sm of subOrgMembros) {
      if (!sm.subOrganizacao || !sm.subOrganizacao.ativa) continue;
      const org = sm.subOrganizacao.organizacao;
      const entry = resultado.get(org.id) ?? {
        ...org,
        papel: 'membro',
        subOrganizacoes: [],
      };
      const jaAdicionada = entry.subOrganizacoes.some(
        (s: any) => s.id === sm.subOrganizacao.id,
      );
      if (!jaAdicionada) {
        entry.subOrganizacoes.push({
          id: sm.subOrganizacao.id,
          nome: sm.subOrganizacao.nome,
          slug: sm.subOrganizacao.slug,
        });
      }
      resultado.set(org.id, entry);
    }

    return Array.from(resultado.values());
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

  async obterOrganizacao(orgId: string, usuarioId: string, isMaster = false) {
    await this.verificarMembroOrg(orgId, usuarioId, isMaster);
    return this.prisma.organizacao.findUnique({
      where: { id: orgId as any },
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
    isMaster = false,
  ) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin'], isMaster);
    return this.prisma.organizacao.update({
      where: { id: orgId as any },
      data,
    });
  }

  async excluirOrganizacao(orgId: string, usuarioId: string, isMaster = false) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono'], isMaster);
    await this.prisma.organizacao.delete({ where: { id: orgId as any } });
    return { ok: true };
  }

  // ─── Membros da organização ───────────────────────────────────────────────

  async listarMembros(orgId: string, usuarioId: string, isMaster = false) {
    await this.verificarMembroOrg(orgId, usuarioId, isMaster);
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
    isMaster = false,
  ) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin'], isMaster);

    const usuario = await this.prisma.botUsuario.findUnique({
      where: { email: emailConvidado },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const jaExiste = await this.prisma.orgMembro.findUnique({
      where: {
        organizacaoId_usuarioId: {
          organizacaoId: orgId as any,
          usuarioId: usuario.id as any,
        },
      },
    });
    if (jaExiste)
      throw new BadRequestException('Usuário já é membro desta organização');

    return this.prisma.orgMembro.create({
      data: { organizacaoId: orgId, usuarioId: usuario.id, papel },
    });
  }

  async removerMembro(orgId: string, solicitanteId: string, membroId: string, isMaster = false) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin'], isMaster);
    await this.prisma.orgMembro.delete({
      where: {
        organizacaoId_usuarioId: {
          organizacaoId: orgId as any,
          usuarioId: membroId as any,
        },
      },
    });
    return { ok: true };
  }

  // ─── Sub-organizações ─────────────────────────────────────────────────────

  async listarSubOrgs(orgId: string, usuarioId: string, isMaster = false) {
    await this.verificarMembroOrg(orgId, usuarioId, isMaster);
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
    isMaster = false,
  ) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin'], isMaster);
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
    isMaster = false,
  ) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin'], isMaster);
    return this.prisma.subOrganizacao.update({
      where: { id: subOrgId as any },
      data,
    });
  }

  async excluirSubOrg(orgId: string, subOrgId: string, usuarioId: string, isMaster = false) {
    await this.verificarPapelOrg(orgId, usuarioId, ['dono', 'admin'], isMaster);
    await this.prisma.subOrganizacao.delete({ where: { id: subOrgId as any } });
    return { ok: true };
  }

  async transferirSubOrg(
    subOrgId: string,
    novaOrgId: string,
    usuarioId: string,
    isMaster = false,
  ) {
    const subOrg = await this.prisma.subOrganizacao.findUnique({
      where: { id: subOrgId as any },
    });
    if (!subOrg) throw new NotFoundException('Sub-organização não encontrada');

    await this.verificarPapelOrg(subOrg.organizacaoId, usuarioId, [
      'dono',
      'admin',
    ], isMaster);
    await this.verificarPapelOrg(novaOrgId, usuarioId, ['dono', 'admin'], isMaster);

    const slug = subOrg.slug;
    const conflito = await this.prisma.subOrganizacao.findUnique({
      where: { organizacaoId_slug: { organizacaoId: novaOrgId, slug } },
    });
    const novoSlug = conflito ? `${slug}-${Date.now()}` : slug;

    return this.prisma.subOrganizacao.update({
      where: { id: subOrgId as any },
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
    isMaster = false,
  ) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin'], isMaster);

    const usuario = await this.prisma.botUsuario.findUnique({
      where: { email: emailConvidado },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const jaExiste = await this.prisma.subOrgMembro.findUnique({
      where: {
        subOrganizacaoId_usuarioId: {
          subOrganizacaoId: subOrgId as any,
          usuarioId: usuario.id as any,
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
    isMaster = false,
  ) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin'], isMaster);
    await this.prisma.subOrgMembro.delete({
      where: {
        subOrganizacaoId_usuarioId: {
          subOrganizacaoId: subOrgId as any,
          usuarioId: membroId as any,
        },
      },
    });
    return { ok: true };
  }

  // ─── Lista membros da sub-organização ─────────────────────────────────────
  async listarMembrosSubOrg(orgId: string, subOrgId: string, usuarioId: string, isMaster = false) {
    await this.verificarMembroOrg(orgId, usuarioId, isMaster);
    return this.prisma.subOrgMembro.findMany({
      where: { subOrganizacaoId: subOrgId },
      include: { usuario: { select: { id: true, email: true, nome: true } } },
    });
  }

  // ─── Convites ─────────────────────────────────────────────────────────────

  async criarConviteOrg(orgId: string, solicitanteId: string, email: string, papel = 'membro', isMaster = false) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin'], isMaster);

    // Verificar se usuário já é membro
    const usuario = await this.prisma.botUsuario.findUnique({ where: { email } });
    if (usuario) {
      const jaExiste = await this.prisma.orgMembro.findUnique({
        where: { organizacaoId_usuarioId: { organizacaoId: orgId as any, usuarioId: usuario.id as any } },
      });
      if (jaExiste) throw new BadRequestException('Usuário já é membro desta organização');
    }

    // Verificar convite pendente duplicado
    const convitePendente = await this.prisma.convite.findFirst({
      where: { orgId, email, status: 'pendente', tipo: 'org' },
    });
    if (convitePendente) throw new BadRequestException('Já existe um convite pendente para este e-mail');

    return this.prisma.convite.create({
      data: { tipo: 'org', orgId, email, papel, convidadoPorId: solicitanteId },
    });
  }

  async criarConviteSubOrg(orgId: string, subOrgId: string, solicitanteId: string, email: string, papel = 'membro', isMaster = false) {
    await this.verificarPapelOrg(orgId, solicitanteId, ['dono', 'admin'], isMaster);

    const usuario = await this.prisma.botUsuario.findUnique({ where: { email } });
    if (usuario) {
      const jaExiste = await this.prisma.subOrgMembro.findUnique({
        where: { subOrganizacaoId_usuarioId: { subOrganizacaoId: subOrgId as any, usuarioId: usuario.id as any } },
      });
      if (jaExiste) throw new BadRequestException('Usuário já é membro desta sub-organização');
    }

    const convitePendente = await this.prisma.convite.findFirst({
      where: { subOrgId, email, status: 'pendente', tipo: 'suborg' },
    });
    if (convitePendente) throw new BadRequestException('Já existe um convite pendente para este e-mail');

    return this.prisma.convite.create({
      data: { tipo: 'suborg', orgId, subOrgId, email, papel, convidadoPorId: solicitanteId },
    });
  }

  async listarMeusConvites(usuarioId: string) {
    const usuario = await this.prisma.botUsuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.convite.findMany({
      where: { email: usuario.email, status: 'pendente' },
      include: {
        org: { select: { id: true, nome: true } },
        subOrg: { select: { id: true, nome: true } },
        convidadoPor: { select: { id: true, nome: true, email: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async aceitarConvite(conviteId: string, usuarioId: string) {
    const convite = await this.prisma.convite.findUnique({ where: { id: conviteId } });
    if (!convite) throw new NotFoundException('Convite não encontrado');

    const usuario = await this.prisma.botUsuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || usuario.email !== convite.email) {
      throw new ForbiddenException('Este convite não é para você');
    }
    if (convite.status !== 'pendente') throw new BadRequestException('Este convite já foi processado');

    await this.prisma.convite.update({ where: { id: conviteId }, data: { status: 'aceito' } });

    if (convite.tipo === 'org' && convite.orgId) {
      await this.prisma.orgMembro.upsert({
        where: { organizacaoId_usuarioId: { organizacaoId: convite.orgId, usuarioId } },
        create: { organizacaoId: convite.orgId, usuarioId, papel: convite.papel },
        update: {},
      });
    } else if (convite.tipo === 'suborg' && convite.subOrgId) {
      await this.prisma.subOrgMembro.upsert({
        where: { subOrganizacaoId_usuarioId: { subOrganizacaoId: convite.subOrgId, usuarioId } },
        create: { subOrganizacaoId: convite.subOrgId, usuarioId, papel: convite.papel },
        update: {},
      });
    }

    return { ok: true };
  }

  async rejeitarConvite(conviteId: string, usuarioId: string) {
    const convite = await this.prisma.convite.findUnique({ where: { id: conviteId } });
    if (!convite) throw new NotFoundException('Convite não encontrado');

    const usuario = await this.prisma.botUsuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || usuario.email !== convite.email) {
      throw new ForbiddenException('Este convite não é para você');
    }
    if (convite.status !== 'pendente') throw new BadRequestException('Este convite já foi processado');

    await this.prisma.convite.update({ where: { id: conviteId }, data: { status: 'rejeitado' } });
    return { ok: true };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private async verificarMembroOrg(orgId: string, usuarioId: string, isMaster = false) {
    if (isMaster) return;
    const membro = await this.prisma.orgMembro.findUnique({
      where: { organizacaoId_usuarioId: { organizacaoId: orgId, usuarioId } },
    });
    if (!membro) throw new ForbiddenException('Sem acesso a esta organização');
  }

  private async verificarPapelOrg(
    orgId: string,
    usuarioId: string,
    papeisPermitidos: string[],
    isMaster = false,
  ) {
    if (isMaster) return;
    const membro = await this.prisma.orgMembro.findUnique({
      where: { organizacaoId_usuarioId: { organizacaoId: orgId, usuarioId } },
      include: { usuario: { select: { papel: true } } },
    });
    // Admin do sistema (BotUsuario.papel = 'admin') tem permissão em qualquer
    // org da qual é membro, independentemente do papel no OrgMembro
    if (membro && membro.usuario.papel === 'admin') return;
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
