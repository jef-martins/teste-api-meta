import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  public isConnected = false;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn(
        '[DB] DATABASE_URL não definida. O banco de dados está DESATIVADO. ' +
        'Funcionalidades que dependem do banco não estarão disponíveis.',
      );
      return;
    }

    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('[DB] Conectado ao PostgreSQL com sucesso.');
    } catch (error) {
      this.logger.error(
        '[DB] Falha ao conectar ao banco de dados. Verifique a DATABASE_URL.',
        error,
      );
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }
}
