import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async listar() {
    return this.prisma.botUsuario.findMany({
      select: { id: true, email: true, nome: true, papel: true, ativo: true, criadoEm: true, atualizadoEm: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async criar(email: string, senha: string, nome?: string, papel?: string) {
    const senhaHash = await bcrypt.hash(senha, 10);
    try {
      return await this.prisma.botUsuario.create({
        data: { email, senhaHash, nome: nome || '', papel: papel || 'admin' },
        select: { id: true, email: true, nome: true, papel: true, ativo: true, criadoEm: true },
      });
    } catch (err: any) {
      if (err.code === 'P2002') throw new BadRequestException('Email já cadastrado');
      throw err;
    }
  }

  async atualizar(id: string, data: { nome?: string; email?: string; papel?: string; ativo?: boolean; senha?: string }) {
    const updateData: any = {
      nome: data.nome,
      email: data.email,
      papel: data.papel,
      ativo: data.ativo,
    };

    if (data.senha) {
      updateData.senhaHash = await bcrypt.hash(data.senha, 10);
    }

    try {
      return await this.prisma.botUsuario.update({
        where: { id },
        data: updateData,
        select: { id: true, email: true, nome: true, papel: true, ativo: true, criadoEm: true, atualizadoEm: true },
      });
    } catch (err: any) {
      if (err.code === 'P2025') throw new NotFoundException('Usuário não encontrado');
      if (err.code === 'P2002') throw new BadRequestException('Email já cadastrado');
      throw err;
    }
  }

  async excluir(id: string, usuarioAtualId: string) {
    if (id === usuarioAtualId) {
      throw new BadRequestException('Você não pode excluir sua própria conta');
    }
    try {
      await this.prisma.botUsuario.delete({ where: { id } });
      return { ok: true };
    } catch (err: any) {
      if (err.code === 'P2025') throw new NotFoundException('Usuário não encontrado');
      throw err;
    }
  }
}
