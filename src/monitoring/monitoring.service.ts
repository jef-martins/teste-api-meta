import { Injectable, NotFoundException } from '@nestjs/common';
import * as os from 'os';
import { PrismaService } from '../prisma/prisma.service';

export interface SnapshotServidor {
  timestamp: number;
  memoriaPercent: number;
  heapPercent: number;
  cpuUsoMedio: number;
  cpuCarga1: number;
}

@Injectable()
export class MonitoringService {
  private snapshots: SnapshotServidor[] = [];
  private readonly MAX_SNAPSHOTS = 30;

  constructor(private prisma: PrismaService) {}

  async listarSessoes() {
    return this.prisma.$queryRaw`
      SELECT u.chat_id, u.nome, u.estado_atual, u.atualizado_em,
             e.handler, e.descricao AS estado_descricao
      FROM bot_estado_usuario u
      LEFT JOIN bot_estado_config e ON u.estado_atual = e.estado
      ORDER BY u.atualizado_em DESC
    `;
  }

  async detalhesSessao(chatId: string) {
    const usuario = await this.prisma.botEstadoUsuario.findUnique({
      where: { chatId },
    });
    if (!usuario) throw new NotFoundException('Sessão não encontrada');

    const historico = await this.prisma.botEstadoHistorico.findMany({
      where: { chatId },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });

    const mensagens = await this.prisma.conversa.findMany({
      where: { OR: [{ quemEnviou: chatId }, { paraQuem: chatId }] },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });

    return { usuario, historico, mensagens };
  }

  async historico(chatId: string) {
    return this.prisma.botEstadoHistorico.findMany({
      where: { chatId },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });
  }

  async dashboard() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    seteDiasAtras.setHours(0, 0, 0, 0);

    const [
      totalSessoes,
      sessoesHoje,
      totalMensagens,
      mensagensHoje,
      transicoesHoje,
      totalFluxos,
      fluxoAtivo,
      estadosMaisUsados,
      mensagensPorDia,
    ] = await Promise.all([
      this.prisma.botEstadoUsuario.count(),
      this.prisma.botEstadoUsuario.count({
        where: { atualizadoEm: { gte: hoje } },
      }),
      this.prisma.conversa.count(),
      this.prisma.conversa.count({ where: { criadoEm: { gte: hoje } } }),
      this.prisma.botEstadoHistorico.count({
        where: { criadoEm: { gte: hoje } },
      }),
      this.prisma.botFluxo.count(),
      this.prisma.botFluxo.findFirst({
        where: { ativo: true },
        select: { id: true, nome: true },
      }),
      this.prisma.$queryRaw`
        SELECT estado_novo AS estado, COUNT(*)::int AS total
        FROM bot_estado_historico
        WHERE criado_em >= ${seteDiasAtras}
        GROUP BY estado_novo ORDER BY total DESC LIMIT 10
      `,
      this.prisma.$queryRaw`
        SELECT DATE(criado_em) AS dia, COUNT(*)::int AS total
        FROM conversa
        WHERE criado_em >= ${seteDiasAtras}
        GROUP BY DATE(criado_em) ORDER BY dia
      `,
    ]);

    return {
      totalSessoes,
      sessoesHoje,
      totalMensagens,
      mensagensHoje,
      transicoesHoje,
      totalFluxos,
      fluxoAtivo: fluxoAtivo || null,
      estadosMaisUsados,
      mensagensPorDia,
    };
  }

  private calcularUsoCpuPorNucleo(): Promise<number[]> {
    return new Promise((resolve) => {
      const inicio = os.cpus().map((cpu) => ({ ...cpu.times }));
      setTimeout(() => {
        const fim = os.cpus();
        const usos = fim.map((cpu, i) => {
          const s = inicio[i];
          const e = cpu.times;
          const totalInicio = s.user + s.nice + s.sys + s.idle + s.irq;
          const totalFim = e.user + e.nice + e.sys + e.idle + e.irq;
          const idleDiff = e.idle - s.idle;
          const totalDiff = totalFim - totalInicio;
          if (totalDiff === 0) return 0;
          return Math.round((1 - idleDiff / totalDiff) * 100);
        });
        resolve(usos);
      }, 200);
    });
  }

  async infoServidor() {
    const loadAvg = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const percentualUsada = Math.round((usedMem / totalMem) * 100);
    const heap = process.memoryUsage();
    const heapPercent = Math.round((heap.heapUsed / heap.heapTotal) * 100);

    const [
      usoPorNucleo,
      dbSize,
      tableStats,
      totalUsuarios,
      totalFluxos,
      totalOrgs,
      totalSubOrgs,
      conexoes,
      cacheHit,
    ] = await Promise.all([
      this.calcularUsoCpuPorNucleo(),
      this.prisma.$queryRaw<{ tamanho: string; bytes: bigint }[]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS tamanho,
               pg_database_size(current_database()) AS bytes
      `,
      this.prisma.$queryRaw<{ tabela: string; registros: bigint; tamanho: string }[]>`
        SELECT relname AS tabela,
               n_live_tup AS registros,
               pg_size_pretty(pg_total_relation_size(relid)) AS tamanho
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 15
      `,
      this.prisma.botUsuario.count(),
      this.prisma.botFluxo.count(),
      this.prisma.organizacao.count(),
      this.prisma.subOrganizacao.count(),
      this.prisma.$queryRaw<{ ativas: bigint; total: bigint }[]>`
        SELECT
          count(*) FILTER (WHERE state = 'active') AS ativas,
          count(*) AS total
        FROM pg_stat_activity
        WHERE datname = current_database()
      `,
      this.prisma.$queryRaw<{ ratio: number | null }[]>`
        SELECT ROUND(
          sum(heap_blks_hit)::numeric /
          NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100,
          1
        ) AS ratio
        FROM pg_statio_user_tables
      `,
    ]);

    const cpus = os.cpus();
    const cpuUsoMedio =
      usoPorNucleo.length > 0
        ? Math.round(usoPorNucleo.reduce((a, b) => a + b, 0) / usoPorNucleo.length)
        : 0;

    const snapshot: SnapshotServidor = {
      timestamp: Date.now(),
      memoriaPercent: percentualUsada,
      heapPercent,
      cpuUsoMedio,
      cpuCarga1: loadAvg[0],
    };
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }

    return {
      coletadoEm: new Date().toISOString(),
      servidor: {
        hostname: os.hostname(),
        plataforma: os.platform(),
        arquitetura: os.arch(),
        versaoNode: process.version,
        uptimeServidor: Math.floor(os.uptime()),
        uptimeProcesso: Math.floor(process.uptime()),
      },
      cpu: {
        nucleos: cpus.length,
        modelo: cpus[0]?.model || 'N/A',
        usoMedioPercent: cpuUsoMedio,
        usoPorNucleo,
        cargaMedia1min: loadAvg[0],
        cargaMedia5min: loadAvg[1],
        cargaMedia15min: loadAvg[2],
      },
      memoria: {
        totalBytes: totalMem,
        livreBytes: freeMem,
        usadaBytes: usedMem,
        percentualUsada,
      },
      heap: {
        usadoBytes: heap.heapUsed,
        totalBytes: heap.heapTotal,
        rssBytes: heap.rss,
        externalBytes: heap.external,
        percentualUsado: heapPercent,
      },
      banco: {
        tamanho: dbSize[0]?.tamanho ?? 'N/A',
        tamanhoBytes: Number(dbSize[0]?.bytes ?? 0),
        conexoesAtivas: Number(conexoes[0]?.ativas ?? 0),
        conexoesTotal: Number(conexoes[0]?.total ?? 0),
        cacheHitRatio: Number(cacheHit[0]?.ratio ?? 0),
        tabelas: tableStats.map((t) => ({
          tabela: t.tabela,
          registros: Number(t.registros),
          tamanho: t.tamanho,
        })),
        totais: {
          usuarios: totalUsuarios,
          fluxos: totalFluxos,
          organizacoes: totalOrgs,
          subOrganizacoes: totalSubOrgs,
        },
      },
    };
  }

  historicoServidor() {
    return this.snapshots;
  }
}
