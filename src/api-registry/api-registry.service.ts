import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class ApiRegistryService {
  constructor(
    private prisma: PrismaService,
    private orgService: OrganizationService,
  ) {}

  // ─── Helpers de acesso ───────────────────────────────────────────────────

  /** Retorna o orgId a partir do subOrgId do usuário */
  private async getOrgIdFromSubOrg(subOrgId: string): Promise<string> {
    const subOrg = await this.prisma.subOrganizacao.findUnique({
      where: { id: subOrgId },
      select: { organizacaoId: true },
    });
    if (!subOrg) throw new NotFoundException('Sub-organização não encontrada');
    return subOrg.organizacaoId;
  }

  private async verificarMembroOrg(orgId: string, usuarioId: string) {
    const membro = await this.prisma.orgMembro.findUnique({
      where: { organizacaoId_usuarioId: { organizacaoId: orgId, usuarioId } },
    });
    if (!membro) throw new ForbiddenException('Sem acesso a esta organização');
  }

  private async verificarAcessoApi(
    apiId: string,
    usuarioId: string,
  ): Promise<string> {
    const api = await this.prisma.apiRegistrada.findUnique({
      where: { id: apiId },
    });
    if (!api) throw new NotFoundException('API não encontrada');
    await this.verificarMembroOrg(api.organizacaoId, usuarioId);
    return api.organizacaoId;
  }

  // ─── APIs ─────────────────────────────────────────────────────────────────

  /**
   * Lista APIs da organização à qual a sub-org pertence.
   * Inclui o token específico da sub-org se existir.
   */
  async listarApis(usuarioId: string, subOrgId: string | null) {
    let orgId: string | null = null;

    if (subOrgId) {
      orgId = await this.getOrgIdFromSubOrg(subOrgId);
      await this.verificarMembroOrg(orgId, usuarioId).catch(async () => {
        // Usuário pode ser membro direto da sub-org sem ser da org
        const temAcesso = await this.orgService.verificarAcessoSubOrg(
          usuarioId,
          subOrgId,
        );
        if (!temAcesso)
          throw new ForbiddenException('Sem acesso a esta sub-organização');
      });
    } else {
      // Sem sub-org: listar da primeira org que o usuário pertence
      const orgMembro = await this.prisma.orgMembro.findFirst({
        where: { usuarioId },
        select: { organizacaoId: true },
      });
      orgId = orgMembro?.organizacaoId ?? null;
    }

    if (!orgId) return [];

    const apis = await this.prisma.apiRegistrada.findMany({
      where: { organizacaoId: orgId },
      include: {
        rotas: { orderBy: { id: 'asc' } },
        subOrgTokens: subOrgId
          ? { where: { subOrganizacaoId: subOrgId } }
          : false,
      },
      orderBy: { criadoEm: 'desc' },
    });

    // Injetar token da sub-org ativa em cada API
    return apis.map((api) => ({
      ...api,
      tokenSubOrg: subOrgId ? (api.subOrgTokens?.[0] ?? null) : null,
      subOrgTokens: undefined,
    }));
  }

  async criarApi(
    usuarioId: string,
    orgId: string,
    data: { nome: string; urlBase: string; headers?: object },
  ) {
    if (!data.nome) throw new BadRequestException('Nome é obrigatório');
    if (!data.urlBase) throw new BadRequestException('URL base é obrigatória');
    await this.verificarMembroOrg(orgId, usuarioId);

    return this.prisma.apiRegistrada.create({
      data: {
        organizacaoId: orgId,
        nome: data.nome,
        urlBase: data.urlBase,
        headers: data.headers ?? {},
      },
      include: { rotas: true },
    });
  }

  async atualizarApi(
    id: string,
    usuarioId: string,
    data: { nome?: string; urlBase?: string; headers?: object },
  ) {
    await this.verificarAcessoApi(id, usuarioId);
    return this.prisma.apiRegistrada.update({
      where: { id },
      data,
      include: { rotas: true },
    });
  }

  async excluirApi(id: string, usuarioId: string) {
    await this.verificarAcessoApi(id, usuarioId);
    await this.prisma.apiRegistrada.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Token por Sub-organização ────────────────────────────────────────────

  async salvarTokenSubOrg(
    apiId: string,
    subOrgId: string,
    usuarioId: string,
    data: { token: string; headers?: object },
  ) {
    const temAcesso = await this.orgService.verificarAcessoSubOrg(
      usuarioId,
      subOrgId,
    );
    if (!temAcesso)
      throw new ForbiddenException('Sem acesso a esta sub-organização');
    await this.verificarAcessoApi(apiId, usuarioId);

    return this.prisma.apiSubOrgToken.upsert({
      where: { apiId_subOrganizacaoId: { apiId, subOrganizacaoId: subOrgId } },
      create: {
        apiId,
        subOrganizacaoId: subOrgId,
        token: data.token,
        headers: data.headers ?? {},
      },
      update: {
        token: data.token,
        headers: data.headers ?? {},
      },
    });
  }

  async removerTokenSubOrg(apiId: string, subOrgId: string, usuarioId: string) {
    const temAcesso = await this.orgService.verificarAcessoSubOrg(
      usuarioId,
      subOrgId,
    );
    if (!temAcesso)
      throw new ForbiddenException('Sem acesso a esta sub-organização');

    await this.prisma.apiSubOrgToken.deleteMany({
      where: { apiId, subOrganizacaoId: subOrgId },
    });
    return { ok: true };
  }

  // ─── Rotas ────────────────────────────────────────────────────────────────

  async listarRotas(apiId: string, usuarioId: string) {
    await this.verificarAcessoApi(apiId, usuarioId);
    return this.prisma.apiRota.findMany({
      where: { apiId },
      orderBy: { id: 'asc' },
    });
  }

  async criarRota(
    apiId: string,
    usuarioId: string,
    data: {
      path: string;
      metodo?: string;
      descricao?: string;
      parametros?: object[];
      bodyTemplate?: object;
    },
  ) {
    await this.verificarAcessoApi(apiId, usuarioId);
    if (!data.path) throw new BadRequestException('Path é obrigatório');

    return this.prisma.apiRota.create({
      data: {
        apiId,
        path: data.path,
        metodo: data.metodo || 'GET',
        descricao: data.descricao,
        parametros: data.parametros ?? [],
        bodyTemplate: data.bodyTemplate,
      },
    });
  }

  async atualizarRota(
    rotaId: string,
    apiId: string,
    usuarioId: string,
    data: {
      path?: string;
      metodo?: string;
      descricao?: string;
      parametros?: object[];
      bodyTemplate?: object;
    },
  ) {
    await this.verificarAcessoApi(apiId, usuarioId);
    const rota = await this.prisma.apiRota.findUnique({
      where: { id: rotaId },
    });
    if (!rota || rota.apiId !== apiId)
      throw new NotFoundException('Rota não encontrada');

    return this.prisma.apiRota.update({ where: { id: rotaId }, data });
  }

  async excluirRota(rotaId: string, apiId: string, usuarioId: string) {
    await this.verificarAcessoApi(apiId, usuarioId);
    const rota = await this.prisma.apiRota.findUnique({
      where: { id: rotaId },
    });
    if (!rota || rota.apiId !== apiId)
      throw new NotFoundException('Rota não encontrada');

    await this.prisma.apiRota.delete({ where: { id: rotaId } });
    return { ok: true };
  }
}
