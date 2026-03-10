import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserData } from './interfaces/update-user.interface';

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
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async criar(email: string, senha: string, nome?: string, papel?: string) {
    const senhaHash = await bcrypt.hash(senha, 10);
    try {
      return await this.prisma.botUsuario.create({
        data: { email, senhaHash, nome: nome || '', papel: papel || 'admin' },
        select: {
          id: true,
          email: true,
          nome: true,
          papel: true,
          ativo: true,
          criadoEm: true,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw new BadRequestException('Email já cadastrado');
      throw err;
    }
  }

  async atualizar(id: string, data: UpdateUserData) {
    const updateData: UpdateUserData = {
      nome: data.nome,
      email: data.email,
      papel: data.papel,
      ativo: data.ativo,
    };

    if (data.senha) {
      updateData.senha = await bcrypt.hash(data.senha, 10);
    }

    const dataForPrisma: any = {
      nome: updateData.nome,
      email: updateData.email,
      papel: updateData.papel,
      ativo: updateData.ativo,
    };

    if (updateData.senha) {
      dataForPrisma.senhaHash = updateData.senha;
    }

    try {
      return await (this.prisma.botUsuario as any).update({
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
    } catch (err: any) {
      if (err?.code === 'P2025')
        throw new NotFoundException('Usuário não encontrado');
      if (err?.code === 'P2002')
        throw new BadRequestException('Email já cadastrado');
      throw err;
    }
  }

  async excluir(id: string, usuarioAtualId: string) {
    if (id === usuarioAtualId) {
      throw new BadRequestException('Você não pode excluir sua própria conta');
    }
    try {
      await (this.prisma.botUsuario as any).delete({ where: { id } });
      return { ok: true };
    } catch (err: any) {
      if (err?.code === 'P2025')
        throw new NotFoundException('Usuário não encontrado');
      throw err;
    }
  }
}
