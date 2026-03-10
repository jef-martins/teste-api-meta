import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EstadoRepository {
  private readonly logger = new Logger(EstadoRepository.name);

  constructor(private prisma: PrismaService) {}

  async obterConfigEstado(estado: string) {
    try {
      const row = await this.prisma.botEstadoConfig.findFirst({
        where: { estado, ativo: true },
        select: { handler: true, descricao: true, config: true },
      });
      if (!row) return null;
      return { handler: row.handler, descricao: row.descricao, config: (row.config as any) ?? {} };
    } catch (err: any) {
      this.logger.error(`Erro ao consultar estado ${estado}: ${err.message}`);
      return null;
    }
  }

  async buscarProximoEstado(estadoAtual: string, entrada: string): Promise<string | null> {
    try {
      // Exact match first
      let row = await this.prisma.botEstadoTransicao.findFirst({
        where: { estadoOrigem: estadoAtual, entrada, ativo: true },
        select: { estadoDestino: true },
      });
      if (row) return row.estadoDestino;

      // Wildcard fallback
      if (entrada !== '*') {
        row = await this.prisma.botEstadoTransicao.findFirst({
          where: { estadoOrigem: estadoAtual, entrada: '*', ativo: true },
          select: { estadoDestino: true },
        });
        if (row) return row.estadoDestino;
      }
      return null;
    } catch (err: any) {
      this.logger.error(`Erro ao buscar próximo estado de ${estadoAtual} via ${entrada}: ${err.message}`);
      return null;
    }
  }

  async obterEstadoUsuario(chatId: string): Promise<string | null> {
    try {
      const row = await this.prisma.botEstadoUsuario.findUnique({
        where: { chatId },
        select: { estadoAtual: true },
      });
      return row?.estadoAtual ?? null;
    } catch (err: any) {
      this.logger.error(`Erro ao obter estado do usuário: ${err.message}`);
      return null;
    }
  }

  async salvarEstadoUsuario(chatId: string, estado: string, nome?: string | null) {
    try {
      await this.prisma.botEstadoUsuario.upsert({
        where: { chatId },
        update: { estadoAtual: estado, nome: nome || undefined },
        create: { chatId, estadoAtual: estado, nome: nome || undefined },
      });
    } catch (err: any) {
      this.logger.error(`Erro ao salvar estado do usuário: ${err.message}`);
    }
  }

  async registrarTransicao(chatId: string, estadoAnterior: string, estadoNovo: string, mensagemGatilho?: string | null) {
    try {
      await this.prisma.botEstadoHistorico.create({
        data: { chatId, estadoAnterior, estadoNovo, mensagemGatilho },
      });
    } catch (err: any) {
      this.logger.error(`Erro ao registrar transição: ${err.message}`);
    }
  }

  async obterEstadoInicial(): Promise<string> {
    try {
      const row = await this.prisma.botEstadoConfig.findFirst({
        where: {
          ativo: true,
          nodeType: 'start',
          fluxo: { ativo: true },
        },
        select: { estado: true },
      });
      return row?.estado || 'NOVO';
    } catch {
      return 'NOVO';
    }
  }
}
