import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserData } from './interfaces/update-user.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async listar() {
    return this.prisma.botUsuario.findMany({
      select: {
        id: true,
        email: true,
        nome: true,
        papel: true,
        master: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async criar(
    email: string,
    senha: string,
    nome?: string,
    papel?: string,
    organizacaoId?: string,
    subOrganizacaoId?: string,
    criadorId?: string,
  ) {
    const senhaHash = await bcrypt.hash(senha, 10);
    try {
      const usuario = await this.prisma.botUsuario.create({
        data: { email, senhaHash, nome: nome || '', papel: papel || 'user' },
        select: {
          id: true,
          email: true,
          nome: true,
          papel: true,
          ativo: true,
          criadoEm: true,
        },
      });

      if (organizacaoId) {
        await (this.prisma.orgMembro as any).create({
          data: { organizacaoId, usuarioId: usuario.id, papel: papel === 'admin' ? 'admin' : 'membro' },
        });
      }

      // Usuário comum com sub-org: cria convite em vez de vínculo direto
      if (subOrganizacaoId && papel !== 'admin' && criadorId) {
        const subOrg = await this.prisma.subOrganizacao.findUnique({
          where: { id: subOrganizacaoId },
          select: { organizacaoId: true },
        });
        if (subOrg) {
          const jaExiste = await this.prisma.convite.findFirst({
            where: { subOrgId: subOrganizacaoId, email, status: 'pendente' },
          });
          if (!jaExiste) {
            await this.prisma.convite.create({
              data: {
                tipo: 'suborg',
                orgId: subOrg.organizacaoId,
                subOrgId: subOrganizacaoId,
                email,
                papel: 'membro',
                convidadoPorId: criadorId,
              },
            });
          }
        }
      } else if (subOrganizacaoId && papel !== 'admin') {
        // Fallback sem criadorId: vínculo direto
        await (this.prisma.subOrgMembro as any).create({
          data: { subOrganizacaoId, usuarioId: usuario.id, papel: 'membro' },
        });
      }

      return usuario;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Email já cadastrado');
      }
      throw error;
    }
  }

  async listarPorAdmin(adminId: string) {
    const orgMembros = await this.prisma.orgMembro.findMany({
      where: { usuarioId: adminId },
      select: { organizacaoId: true },
    });
    const orgIds = orgMembros.map((o) => o.organizacaoId);
    if (!orgIds.length) return [];

    const subOrgs = await this.prisma.subOrganizacao.findMany({
      where: { organizacaoId: { in: orgIds } },
      select: { id: true },
    });
    const subOrgIds = subOrgs.map((s) => s.id);
    if (!subOrgIds.length) return [];

    const membros = await this.prisma.subOrgMembro.findMany({
      where: { subOrganizacaoId: { in: subOrgIds } },
      select: { usuarioId: true },
    });
    const userIds = [...new Set(membros.map((m) => m.usuarioId))];
    if (!userIds.length) return [];

    return this.prisma.botUsuario.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        nome: true,
        papel: true,
        master: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizar(id: string, data: UpdateUserData) {
    const updateData: UpdateUserData = {
      nome: data.nome,
      email: data.email,
      papel: data.papel,
      master: data.master,
      ativo: data.ativo,
    };

    if (data.senha) {
      updateData.senha = await bcrypt.hash(data.senha, 10);
    }

    const dataForPrisma: Prisma.BotUsuarioUpdateInput = {
      nome: updateData.nome,
      email: updateData.email,
      papel: updateData.papel,
      master: updateData.master,
      ativo: updateData.ativo,
    };

    if (updateData.senha) {
      dataForPrisma.senhaHash = updateData.senha;
    }

    try {
      return await this.prisma.botUsuario.update({
        where: { id },
        data: dataForPrisma,
        select: {
          id: true,
          email: true,
          nome: true,
          papel: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025')
          throw new NotFoundException('Usuário não encontrado');
        if (error.code === 'P2002')
          throw new BadRequestException('Email já cadastrado');
      }
      throw error;
    }
  }

  async excluir(id: string, usuarioAtualId: string) {
    if (id === usuarioAtualId) {
      throw new BadRequestException('Você não pode excluir sua própria conta');
    }
    try {
      await this.prisma.botUsuario.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Usuário não encontrado');
      }
      throw error;
    }
  }
}
