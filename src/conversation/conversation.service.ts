import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  async listar() {
    return this.prisma.conversa.findMany({ orderBy: { criadoEm: 'desc' } });
  }

  async salvarMensagem(
    nome: string | null,
    dados: any,
    quemEnviou: string | null,
    paraQuem: string | null,
    mensagem: string | null,
  ) {
    return this.prisma.conversa.create({
      data: { nome, dados, quemEnviou, paraQuem, mensagem },
    });
  }
}
