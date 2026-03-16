import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';
import { PrismaService } from '../prisma/prisma.service';
import { FlowService } from '../flow/flow.service';

const PERSIST_DEBOUNCE_MS = 2000;
const ROOM_CLEANUP_TIMEOUT_MS = 30000;

interface Room {
  doc: Y.Doc;
  connections: Set<string>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  pendingUpdates: Uint8Array[];
}

@Injectable()
export class CollaborationService implements OnModuleDestroy {
  private readonly logger = new Logger(CollaborationService.name);
  private rooms = new Map<string, Room>();

  constructor(
    private prisma: PrismaService,
    private flowService: FlowService,
  ) {}

  async onModuleDestroy() {
    for (const [flowId, room] of this.rooms) {
      if (room.persistTimer) clearTimeout(room.persistTimer);
      if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
      await this.persistUpdates(flowId, room);
      room.doc.destroy();
    }
    this.rooms.clear();
  }

  async getOrCreateRoom(flowId: string): Promise<Room> {
    let room = this.rooms.get(flowId);
    if (room) {
      if (room.cleanupTimer) {
        clearTimeout(room.cleanupTimer);
        room.cleanupTimer = null;
      }
      return room;
    }

    const doc = new Y.Doc();
    room = {
      doc,
      connections: new Set(),
      persistTimer: null,
      cleanupTimer: null,
      pendingUpdates: [],
    };

    await this.loadFlowState(flowId, doc);

    this.rooms.set(flowId, room);
    this.logger.log(`Room criada para fluxo ${flowId}`);
    return room;
  }

  addConnection(flowId: string, clientId: string) {
    const room = this.rooms.get(flowId);
    if (room) {
      room.connections.add(clientId);
      this.logger.debug(
        `Client ${clientId} entrou na room ${flowId} (${room.connections.size} conectados)`,
      );
    }
  }

  removeConnection(flowId: string, clientId: string) {
    const room = this.rooms.get(flowId);
    if (!room) return;

    room.connections.delete(clientId);
    this.logger.debug(
      `Client ${clientId} saiu da room ${flowId} (${room.connections.size} conectados)`,
    );

    if (room.connections.size === 0) {
      room.cleanupTimer = setTimeout(() => {
        this.cleanupRoom(flowId).catch((err) => {
          this.logger.error(`Erro ao limpar room ${flowId}:`, err);
        });
      }, ROOM_CLEANUP_TIMEOUT_MS);
    }
  }

  getDoc(flowId: string): Y.Doc | null {
    return this.rooms.get(flowId)?.doc ?? null;
  }

  getStateDiff(
    flowId: string,
    remoteStateVector: Uint8Array,
  ): Uint8Array | null {
    const doc = this.getDoc(flowId);
    if (!doc) return null;
    return Y.encodeStateAsUpdate(doc, remoteStateVector);
  }

  applyUpdate(flowId: string, update: Uint8Array) {
    const room = this.rooms.get(flowId);
    if (!room) return;

    Y.applyUpdate(room.doc, update);
    room.pendingUpdates.push(update);
    this.schedulePersist(flowId, room);
  }

  private schedulePersist(flowId: string, room: Room) {
    if (room.persistTimer) return;

    room.persistTimer = setTimeout(() => {
      room.persistTimer = null;
      this.persistUpdates(flowId, room).catch((err) => {
        this.logger.error(`Erro ao persistir updates da room ${flowId}:`, err);
      });
    }, PERSIST_DEBOUNCE_MS);
  }

  private async persistUpdates(flowId: string, room: Room) {
    if (room.pendingUpdates.length === 0) return;

    const mergedUpdate = Y.mergeUpdates(room.pendingUpdates);
    room.pendingUpdates = [];

    try {
      await this.prisma.yjsUpdate.create({
        data: { flowId, update: Buffer.from(mergedUpdate) },
      });

      // Also update flow_json from Yjs doc state
      await this.syncFlowJsonFromDoc(flowId, room.doc);

      await this.compactUpdatesIfNeeded(flowId);
      this.logger.debug(`Updates persistidos para fluxo ${flowId}`);
    } catch (error) {
      this.logger.error(`Falha ao persistir updates do fluxo ${flowId}`, error);
      room.pendingUpdates.push(mergedUpdate);
    }
  }

  private async syncFlowJsonFromDoc(flowId: string, doc: Y.Doc) {
    const nodesMap = doc.getMap('nodes');
    const connectionsMap = doc.getMap('connections');
    const variablesMap = doc.getMap('variables');

    const nodes = Array.from(nodesMap.values()) as any[];
    const connections = Array.from(connectionsMap.values()) as any[];
    const variables = Array.from(variablesMap.values()) as any[];

    if (nodes.length > 0 || connections.length > 0) {
      const flowJson = { nodes, connections, variables };
      await this.prisma.botFluxo.update({
        where: { id: flowId },
        data: { flowJson: flowJson as any },
      });

      // Compila o fluxo para bot_estado_config/bot_estado_transicao
      await this.flowService.recompilarFluxo(flowId, flowJson);
    }
  }

  private async compactUpdatesIfNeeded(flowId: string) {
    const count = await this.prisma.yjsUpdate.count({ where: { flowId } });
    if (count < 50) return;

    const allUpdates = await this.prisma.yjsUpdate.findMany({
      where: { flowId },
      orderBy: { criadoEm: 'asc' },
      select: { id: true, update: true },
    });

    const merged = Y.mergeUpdates(
      allUpdates.map((u) => new Uint8Array(u.update)),
    );

    await this.prisma.$transaction([
      this.prisma.yjsUpdate.deleteMany({ where: { flowId } }),
      this.prisma.yjsUpdate.create({
        data: { flowId, update: Buffer.from(merged) },
      }),
    ]);

    this.logger.log(
      `Compactados ${allUpdates.length} updates em 1 para fluxo ${flowId}`,
    );
  }

  private async loadFlowState(flowId: string, doc: Y.Doc) {
    // Load from Yjs updates first
    const updates = await this.prisma.yjsUpdate.findMany({
      where: { flowId },
      orderBy: { criadoEm: 'asc' },
      select: { update: true },
    });

    if (updates.length > 0) {
      const merged = Y.mergeUpdates(
        updates.map((u) => new Uint8Array(u.update)),
      );
      Y.applyUpdate(doc, merged);
      this.logger.log(
        `Carregados ${updates.length} updates para fluxo ${flowId}`,
      );
      return;
    }

    // Fallback: load from flow_json
    const fluxo = await this.prisma.botFluxo.findUnique({
      where: { id: flowId },
      select: { flowJson: true },
    });

    if (fluxo?.flowJson) {
      const flowData = fluxo.flowJson as any;
      const nodesMap = doc.getMap('nodes');
      const connectionsMap = doc.getMap('connections');
      const variablesMap = doc.getMap('variables');

      doc.transact(() => {
        for (const node of flowData.nodes || []) {
          nodesMap.set(node.id, node);
        }
        for (const conn of flowData.connections || []) {
          connectionsMap.set(conn.id, conn);
        }
        for (const v of flowData.variables || []) {
          variablesMap.set(v.id || v.key, v);
        }
      });

      this.logger.log(`Fluxo ${flowId} carregado do flow_json`);
    }
  }

  private async cleanupRoom(flowId: string) {
    const room = this.rooms.get(flowId);
    if (!room || room.connections.size > 0) return;

    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
      room.persistTimer = null;
    }

    await this.persistUpdates(flowId, room);
    room.doc.destroy();
    this.rooms.delete(flowId);
    this.logger.log(`Room limpa para fluxo ${flowId}`);
  }
}
