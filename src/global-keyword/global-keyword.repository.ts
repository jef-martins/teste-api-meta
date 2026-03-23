import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GlobalKeywordRepository {
  constructor(private prisma: PrismaService) {}

  async listar() {
    if (!this.prisma.isConnected) return [];
    return this.prisma.botKeywordGlobal.findMany({
      orderBy: [{ keyword: 'asc' }],
    });
  }

  async buscarPorId(id: string) {
    if (!this.prisma.isConnected) return null;
    return this.prisma.botKeywordGlobal.findUnique({ where: { id } });
  }

  async buscarPorKeyword(keyword: string) {
    if (!this.prisma.isConnected) return null;
    return this.prisma.botKeywordGlobal.findUnique({ where: { keyword } });
  }

  async buscarKeywordAtiva(keyword: string) {
    if (!this.prisma.isConnected) return null;
    return this.prisma.botKeywordGlobal.findFirst({
      where: { keyword, ativo: true },
    });
  }

  async criar(data: {
    keyword: string;
    estadoDestino: string;
    ativo: boolean;
  }) {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    return this.prisma.botKeywordGlobal.create({
      data,
    });
  }

  async atualizar(
    id: string,
    data: { keyword: string; estadoDestino: string; ativo: boolean },
  ) {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    return this.prisma.botKeywordGlobal.update({
      where: { id },
      data,
    });
  }

  async atualizarAtivo(id: string, ativo: boolean) {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    return this.prisma.botKeywordGlobal.update({
      where: { id },
      data: { ativo },
    });
  }

  async excluir(id: string) {
    if (!this.prisma.isConnected)
      throw new Error('Banco de dados indisponível');
    return this.prisma.botKeywordGlobal.delete({ where: { id } });
  }
}
