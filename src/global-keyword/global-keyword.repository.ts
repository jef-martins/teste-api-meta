import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GlobalKeywordRepository {
  constructor(private prisma: PrismaService) {}

  async listar() {
    return this.prisma.botKeywordGlobal.findMany({
      orderBy: [{ keyword: 'asc' }],
    });
  }

  async buscarPorId(id: string) {
    return this.prisma.botKeywordGlobal.findUnique({ where: { id } });
  }

  async buscarPorKeyword(keyword: string) {
    return this.prisma.botKeywordGlobal.findUnique({ where: { keyword } });
  }

  async buscarKeywordAtiva(keyword: string) {
    return this.prisma.botKeywordGlobal.findFirst({
      where: { keyword, ativo: true },
    });
  }

  async criar(data: { keyword: string; estadoDestino: string; ativo: boolean }) {
    return this.prisma.botKeywordGlobal.create({
      data,
    });
  }

  async atualizar(
    id: string,
    data: { keyword: string; estadoDestino: string; ativo: boolean },
  ) {
    return this.prisma.botKeywordGlobal.update({
      where: { id },
      data,
    });
  }

  async atualizarAtivo(id: string, ativo: boolean) {
    return this.prisma.botKeywordGlobal.update({
      where: { id },
      data: { ativo },
    });
  }

  async excluir(id: string) {
    return this.prisma.botKeywordGlobal.delete({ where: { id } });
  }
}
