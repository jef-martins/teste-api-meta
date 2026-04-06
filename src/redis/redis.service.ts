import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly useRedis: boolean;
  
  // Memória local para fallback caso o Redis caia
  private readonly memoryFallback = new Map<string, { value: string; expires?: number }>();

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.useRedis = !!redisUrl;

    if (this.useRedis) {
      this.client = new Redis(redisUrl as string, {
        maxRetriesPerRequest: 1, // Falha rápido para acionar o fallback
        enableReadyCheck: true,
        connectTimeout: 5000,
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis offline ou com erro. Usando fallback In-Memory.', err.message);
      });

      this.client.on('connect', () => {
        this.logger.log('Conectado ao Redis com sucesso.');
      });
    } else {
      this.logger.warn('REDIS_URL não configurada. Operando exclusivamente em modo In-Memory.');
    }
  }

  onModuleInit() {}

  onModuleDestroy() {
    if (this.client) {
      this.client.quit();
    }
  }

  /**
   * Tenta buscar no Redis. Se falhar ou estiver offline, busca na memória local.
   */
  async get(key: string): Promise<string | null> {
    if (this.client) {
      try {
        const val = await this.client.get(key);
        if (val !== null) return val;
      } catch (err) {
        this.logger.warn(`Erro ao ler do Redis (chave: ${key}), tentando fallback local.`);
      }
    }

    // Fallback: Memória RAM
    const local = this.memoryFallback.get(key);
    if (!local) return null;

    // Verificar expiração manual no fallback
    if (local.expires && Date.now() > local.expires) {
      this.memoryFallback.delete(key);
      return null;
    }

    return local.value;
  }

  /**
   * Salva no Redis. Se falhar, salva na memória local.
   */
  async set(
    key: string,
    value: string,
    mode?: 'EX' | 'PX',
    duration?: number,
  ): Promise<void> {
    // 1. Tenta salvar no Redis
    let redisSuccess = false;
    if (this.client) {
      try {
        if (mode === 'EX' && duration) {
          await this.client.set(key, value, 'EX', duration);
        } else if (mode === 'PX' && duration) {
          await this.client.set(key, value, 'PX', duration);
        } else {
          await this.client.set(key, value);
        }
        redisSuccess = true;
      } catch (err) {
        this.logger.warn(`Erro ao salvar no Redis, usando fallback em memória.`);
      }
    }

    // 2. Espelha na memória local (sempre, ou como fallback)
    const expires = duration 
      ? Date.now() + (mode === 'PX' ? duration : duration * 1000) 
      : undefined;
    
    this.memoryFallback.set(key, { value, expires });
  }

  /**
   * Remove de ambos.
   */
  async del(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.del(key);
      } catch {}
    }
    this.memoryFallback.delete(key);
  }
}
