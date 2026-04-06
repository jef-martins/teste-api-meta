import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  public isConnected = false;

  private readonly healthCheckIntervalMs = 60_000;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn(
        '[DB] DATABASE_URL não definida. O banco de dados está DESATIVADO. ' +
          'Funcionalidades que dependem do banco não estarão disponíveis.',
      );
      return;
    }

    await this._tryConnect();
    this._startHealthCheck();
  }

  private async _tryConnect(): Promise<void> {
    try {
      await this.$connect();
      if (!this.isConnected) {
        this.isConnected = true;
        this.logger.log('{"event":"db_recovered","msg":"Conectado ao PostgreSQL com sucesso."}');
        this.eventEmitter.emit('db.reconnected');
      }
    } catch (error) {
      if (this.isConnected) {
        this.isConnected = false;
        this.logger.error(
          '{"event":"db_down","msg":"Conexão com o banco de dados perdida."}',
          error,
        );
      } else {
        this.logger.error(
          '{"event":"db_down","msg":"Falha ao conectar ao banco de dados. Verifique a DATABASE_URL."}',
          error,
        );
      }
    }
  }

  async isAlive(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      if (!this.isConnected) {
        this.isConnected = true;
        this.logger.log('{"event":"db_recovered","msg":"Banco de dados voltou à vida."}');
        this.eventEmitter.emit('db.reconnected');
      }
      return true;
    } catch {
      if (this.isConnected) {
        this.isConnected = false;
        this.logger.error('{"event":"db_down","msg":"Health-check falhou — banco indisponível."}');
      }
      return false;
    }
  }

  private _startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      void this.isAlive();
    }, this.healthCheckIntervalMs);
  }

  async onModuleDestroy() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.isConnected) {
      await this.$disconnect();
    }
  }
}
