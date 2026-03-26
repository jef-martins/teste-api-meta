import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly useRedis: boolean;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.useRedis = !!redisUrl;

    if (this.useRedis) {
      this.client = new Redis(redisUrl as string, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis Client Error', err);
      });

      this.client.on('connect', () => {
        this.logger.log('Conectado ao Redis');
      });
    } else {
      this.logger.warn('REDIS_URL não configurada. Cache do Redis será desativado (usando fallback ou in-memory limitados).');
    }
  }

  onModuleInit() {
    // Inicialização, client já instanciado no constructor se aplicável.
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.quit();
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(
    key: string,
    value: string,
    mode?: 'EX' | 'PX' | 'NX' | 'XX',
    duration?: number,
  ): Promise<void> {
    if (!this.client) return;
    if (mode === 'EX' && duration) {
      await this.client.set(key, value, 'EX', duration);
    } else if (mode === 'PX' && duration) {
      await this.client.set(key, value, 'PX', duration);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }
}
