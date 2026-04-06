import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { EstadoRepository } from './estado.repository';
import { HandlerService } from './handler.service';

/**
 * Chave Redis onde a configuração global de expiração por ociosidade fica armazenada.
 * Formato: { tempoExpiracaoMs: number | null, mensagemExpiracao: string | null }
 */
const CONFIG_KEY = 'bot:config:expiracao-ociosidade';

/**
 * Prefixo das sessões de usuário no Redis.
 * Cada sessão fica em: session:{chatId}
 */
const SESSION_PREFIX = 'session:';

export type ConfigExpiracaoOciosidade = {
  tempoExpiracaoMs: number | null;
  mensagemExpiracao: string | null;
};

@Injectable()
export class IdleExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdleExpirationService.name);
  private checkTimer: NodeJS.Timeout | null = null;
  private config: ConfigExpiracaoOciosidade = {
    tempoExpiracaoMs: null,
    mensagemExpiracao: null,
  };

  constructor(
    private redis: RedisService,
    private estadoRepository: EstadoRepository,
    private handler: HandlerService,
  ) {}

  async onModuleInit() {
    await this.carregarConfig();
    // Verifica chatIds ociosos a cada 60 segundos
    this.checkTimer = setInterval(() => void this.verificarOciosos(), 60_000);
    this.logger.log(
      `[IdleExpiration][init] tempoExpiracaoMs=${this.config.tempoExpiracaoMs ?? 'desativado'}`,
    );
  }

  onModuleDestroy() {
    if (this.checkTimer) clearInterval(this.checkTimer);
  }

  // ─── Config ──────────────────────────────────────────────────────────────

  async carregarConfig(): Promise<ConfigExpiracaoOciosidade> {
    try {
      const raw = await this.redis.get(CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConfigExpiracaoOciosidade;
        this.config = {
          tempoExpiracaoMs: typeof parsed.tempoExpiracaoMs === 'number' ? parsed.tempoExpiracaoMs : null,
          mensagemExpiracao: typeof parsed.mensagemExpiracao === 'string' ? parsed.mensagemExpiracao : null,
        };
      }
    } catch (err) {
      this.logger.warn(`[IdleExpiration][config-load-error] ${String(err)}`);
    }
    return this.config;
  }

  async salvarConfig(config: ConfigExpiracaoOciosidade): Promise<ConfigExpiracaoOciosidade> {
    this.config = config;
    try {
      await this.redis.set(CONFIG_KEY, JSON.stringify(config));
      this.logger.log(
        `[IdleExpiration][config-saved] tempoExpiracaoMs=${config.tempoExpiracaoMs ?? 'desativado'} mensagem="${config.mensagemExpiracao ?? ''}"`,
      );
    } catch (err) {
      this.logger.warn(`[IdleExpiration][config-save-error] ${String(err)}`);
    }
    return this.config;
  }

  obterConfig(): ConfigExpiracaoOciosidade {
    return { ...this.config };
  }

  // ─── Rastreamento de atividade ────────────────────────────────────────────

  /**
   * Chamado sempre que um chatId (Meta/WPP) processa uma mensagem.
   * Atualiza o timestamp de última atividade na sessão Redis.
   */
  async registrarAtividade(chatId: string): Promise<void> {
    if (!chatId) return;
    try {
      const key = `${SESSION_PREFIX}${chatId}`;
      const raw = await this.redis.get(key);
      let sessao: Record<string, unknown> = {};
      if (raw) {
        try { sessao = JSON.parse(raw) as Record<string, unknown>; } catch { /**/ }
      }
      sessao.ultimaAtividadeEm = new Date().toISOString();
      // Mantém o TTL original (7 dias em segundos) ao atualizar
      await this.redis.set(key, JSON.stringify(sessao), 'EX', 604800);
    } catch (err) {
      this.logger.warn(`[IdleExpiration][activity-error] chatId=${chatId} ${String(err)}`);
    }
  }

  // ─── Verificação de ociosos ────────────────────────────────────────────────

  private async verificarOciosos(): Promise<void> {
    if (!this.config.tempoExpiracaoMs || this.config.tempoExpiracaoMs <= 0) return;

    try {
      const chaves = await this.redis.keys(`${SESSION_PREFIX}*`);
      const agora = Date.now();

      for (const chave of chaves) {
        // Ignora sessões Zenvia (são gerenciadas pelo ZenviaService)
        if (!chave.startsWith(SESSION_PREFIX)) continue;
        const chatId = chave.slice(SESSION_PREFIX.length);
        if (!chatId || chatId.includes('zenvia')) continue;

        try {
          const raw = await this.redis.get(chave);
          if (!raw) continue;

          let sessao: Record<string, unknown>;
          try { sessao = JSON.parse(raw) as Record<string, unknown>; } catch { continue; }

          const ultimaAtividade = typeof sessao.ultimaAtividadeEm === 'string'
            ? Date.parse(sessao.ultimaAtividadeEm)
            : null;

          // Se nunca houve atividade registrada via este serviço, ignora
          if (!ultimaAtividade || isNaN(ultimaAtividade)) continue;

          const ociosaMs = agora - ultimaAtividade;
          if (ociosaMs < this.config.tempoExpiracaoMs) continue;

          this.logger.warn(
            `[IdleExpiration][trigger] chatId=${chatId} ocioso=${Math.round(ociosaMs / 1000)}s (limite=${this.config.tempoExpiracaoMs / 1000}s)`,
          );

          await this.expirarChatId(chatId, sessao);
        } catch (errInner) {
          this.logger.error(`[IdleExpiration][check-error] chatId=${chave} ${String(errInner)}`);
        }
      }
    } catch (err) {
      this.logger.error(`[IdleExpiration][scan-error] ${String(err)}`);
    }
  }

  private async expirarChatId(chatId: string, sessao: Record<string, unknown>): Promise<void> {
    try {
      // 1. Envia mensagem de expiração se configurada
      if (this.config.mensagemExpiracao && this.handler?.client?.sendText) {
        try {
          await this.handler.client.sendText(chatId, this.config.mensagemExpiracao);
          this.logger.log(`[IdleExpiration][msg-sent] chatId=${chatId}`);
        } catch (errMsg) {
          this.logger.warn(`[IdleExpiration][msg-error] chatId=${chatId} ${String(errMsg)}`);
        }
      }

      // 2. Reseta para o estado inicial do fluxo
      const estadoInicial = await this.estadoRepository.obterEstadoInicial();
      const nome = typeof sessao.nome === 'string' ? sessao.nome : undefined;
      await this.estadoRepository.salvarEstadoUsuario(chatId, estadoInicial, nome);

      this.logger.log(
        `[IdleExpiration][reset] chatId=${chatId} estado=${estadoInicial}`,
      );
    } catch (err) {
      this.logger.error(`[IdleExpiration][expire-error] chatId=${chatId} ${String(err)}`);
    }
  }
}
