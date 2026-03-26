import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private indisponibilidadeAvisada = false;

  constructor(private prisma: PrismaService) { }

  private avisarBancoIndisponivel() {
    if (this.indisponibilidadeAvisada) {
      return;
    }

    this.indisponibilidadeAvisada = true;
    this.logger.warn(
      '[DB] Prisma indisponível. Operações de conversa serão ignoradas até a conexão voltar.',
    );
  }

  async listar() {
    if (!this.prisma.isConnected) {
      this.avisarBancoIndisponivel();
      return [];
    }

    return this.prisma.conversa.findMany({ orderBy: { criadoEm: 'desc' } });
  }

  async salvarMensagem(
    nome: string | null,
    dados: unknown,
    quemEnviou: string | null,
    paraQuem: string | null,
    mensagem: string | null,
  ) {
    if (!this.prisma.isConnected) {
      this.avisarBancoIndisponivel();
      return null;
    }
    return this.prisma.conversa.create({
      data: {
        nome,
        dados: dados as Prisma.InputJsonValue,
        quemEnviou,
        paraQuem,
        mensagem,
      },
    });
  }
}
