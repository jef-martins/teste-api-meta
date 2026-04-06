import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { EstadoRepository } from './estado.repository';
import { HandlerService } from './handler.service';

import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_ESTADOS,
  MEMORY_SESSIONS,
} from './default-state-machine.config';


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

  constructor(
    private redis: RedisService,
    private estadoRepository: EstadoRepository,
    private handler: HandlerService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Verifica chatIds ociosos a cada 60 segundos
    this.checkTimer = setInterval(() => void this.verificarTodosOciosos(), 60_000);
    this.logger.log(`[IdleExpiration][init] Operando em modo estritamente por fluxo (Opção B).`);
  }

  onModuleDestroy() {
    if (this.checkTimer) clearInterval(this.checkTimer);
  }



  // Rastreamento de atividade

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


  // Verificação de ociosos
  
  private flowCache = new Map<string, { ms: number; msg: string | null }>();

  async verificarTodosOciosos(): Promise<void> {
    try {
      const chaves = await this.redis.keys(`${SESSION_PREFIX}*`);
      const agora = Date.now();
      this.flowCache.clear(); // Limpa cache de fluxos a cada varredura para pegar atualizações do banco

      for (const chave of chaves) {
        const chatId = chave.slice(SESSION_PREFIX.length);
        if (!chatId) continue;

        try {
          const raw = await this.redis.get(chave);
          if (!raw) continue;

          let sessao: any;
          try { sessao = JSON.parse(raw); } catch { continue; }

          const ultimaAtividade = typeof sessao.ultimaAtividadeEm === 'string'
            ? Date.parse(sessao.ultimaAtividadeEm)
            : null;

          if (!ultimaAtividade || isNaN(ultimaAtividade)) continue;

          // DETERMINAÇÃO DO TIMEOUT (POR PRIORIDADE)
          let tempoLimiteMs = 0;
          let msgExpiracao: string | null = null;

          // 1. Prioridade Máxima: Configuração Dinâmica na Sessão (Zenvia NPS)
          if (sessao.meta && typeof sessao.meta.tempoExpiracaoMs === 'number') {
            tempoLimiteMs = sessao.meta.tempoExpiracaoMs;
          }

          // 2. Segunda Prioridade: Configuração por Fluxo (Banco ou Memória)
          if (tempoLimiteMs <= 0 && sessao.flowId) {
            const flowCfg = await this.obterConfigFluxo(sessao.flowId);
            if (flowCfg && flowCfg.ms > 0) {
              tempoLimiteMs = flowCfg.ms;
              if (flowCfg.msg) msgExpiracao = flowCfg.msg;
            }
          }


          if (!tempoLimiteMs || tempoLimiteMs <= 0) continue;

          const ociosaMs = agora - ultimaAtividade;
          if (ociosaMs < tempoLimiteMs) continue;

          this.logger.warn(
            `[IdleExpiration][trigger] chatId=${chatId} flowId=${sessao.flowId || 'global'} ocioso=${Math.round(ociosaMs / 1000)}s (limite=${tempoLimiteMs / 1000}s)`,
          );

          await this.expirarChatId(chatId, sessao, msgExpiracao);
        } catch (errInner) {
          this.logger.error(`[IdleExpiration][check-error] chatId=${chave} ${String(errInner)}`);
        }
      }
    } catch (err) {
      this.logger.error(`[IdleExpiration][scan-error] ${String(err)}`);
    }
  }

  private async obterConfigFluxo(flowId: string): Promise<{ ms: number; msg: string | null } | null> {
    if (this.flowCache.has(flowId)) return this.flowCache.get(flowId)!;

    let config: { ms: number; msg: string | null } | null = null;

    if (process.env.BOT_STATE_MACHINE_PADRAO === 'true') {
      // Modo Memória
      if (flowId === '') {
         // O fluxo padrão ('') não tem config de timeout individual no código legado,
         // então retorna null para usar o global.
      } else if (MEMORY_SESSIONS[flowId]) {
         // Se houver alguma config futura em MEMORY_SESSIONS, pegaria aqui.
      }
    } else {
      // Modo Banco
      try {
        const flow = await (this.prisma.botFluxo as any).findUnique({
          where: { id: flowId },
          select: { tempoExpiracaoMinutos: true, mensagemExpiracao: true }
        });
        if (flow) {
          config = {
            ms: (flow.tempoExpiracaoMinutos || 0) * 60 * 1000,
            msg: flow.mensagemExpiracao || null
          };
        }
      } catch (err) {
        this.logger.error(`[IdleExpiration][flow-config-error] flowId=${flowId} ${String(err)}`);
      }
    }

    if (config) this.flowCache.set(flowId, config);
    return config;
  }

  private async expirarChatId(chatId: string, sessao: any, msgOverride?: string | null): Promise<void> {
    try {
      const estadoAtual = sessao.estado || (await this.estadoRepository.obterEstadoInicial());
      const configEstado = await this.estadoRepository.obterConfigEstado(estadoAtual, chatId);

      // PRIORIDADE DE MENSAGEM: Estado > Fluxo/Sessão (msgOverride)
      let msgTrigger = (configEstado?.config as any)?.mensagemExpiracao || msgOverride;

      if (msgTrigger) {
        try {
          await this.handler.client?.sendText(chatId, String(msgTrigger));
        } catch (e) {
          this.logger.warn(`[IdleExpiration][msg-error] chatId=${chatId} ${e}`);
        }
      }

      // 2. Comportamento pós-expiração
      if (chatId.startsWith('zenvia:')) {
        // Para fluxos dinâmicos Zenvia (NPS), encerramos a sessão e enviamos callback 'expired'
        this.logger.log(`[IdleExpiration][zenvia-end] nps_id=${sessao.meta?.nps_id}`);
        await this.redis.del(`${SESSION_PREFIX}${chatId}`);
        const pair = `${sessao.meta?.from}::${sessao.meta?.to}`;
        await this.redis.del(`zenvia:pair:${pair}`);

        if (sessao.meta?.callbackUrl) {
           fetch(sessao.meta.callbackUrl, {
             method: 'POST',
             headers: { ...sessao.meta.callbackHeaders, 'Content-Type': 'application/json' },
             body: JSON.stringify({
               nps_id: sessao.meta.nps_id,
               conversa_id: sessao.meta.conversa_id,
               status: 'expired',
               motivo: 'idle_timeout'
             })
           }).catch(() => {});
        }
      } else {
        // Para Meta/WPP, resetamos para o estado inicial
        const estadoInicial = await this.estadoRepository.obterEstadoInicial();
        await this.estadoRepository.salvarEstadoUsuario(chatId, estadoInicial, sessao.nome);
        this.logger.log(`[IdleExpiration][reset] chatId=${chatId} -> ${estadoInicial}`);
      }
    } catch (err) {
      this.logger.error(`[IdleExpiration][expire-error] chatId=${chatId} ${String(err)}`);
    }
  }
}
