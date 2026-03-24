import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';
import { PrismaService } from '../prisma/prisma.service';
import { FlowService } from '../flow/flow.service';

const PERSIST_DEBOUNCE_MS = 2000;
const RECOMPILE_DEBOUNCE_MS = 10000; // Recompile bot state less often (every 10s max)
const ROOM_CLEANUP_TIMEOUT_MS = 30000;

interface Room {
  doc: Y.Doc;
  connections: Set<string>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  recompileTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  pendingUpdates: Uint8Array[];
  needsRecompile: boolean;
  /** 'flow' for BotFluxo rooms, 'component' for ComponentePersonalizado rooms */
  roomType: 'flow' | 'component';
  /** The actual entity ID (flowId or componentId) */
  entityId: string;
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
    for (const [roomKey, room] of this.rooms) {
      if (room.persistTimer) clearTimeout(room.persistTimer);
      if (room.recompileTimer) clearTimeout(room.recompileTimer);
      if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
      await this.persistUpdates(roomKey, room);
      if (room.needsRecompile && room.roomType === 'flow') {
        await this.recompileFlow(room.entityId, room);
      }
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
      recompileTimer: null,
      cleanupTimer: null,
      pendingUpdates: [],
      needsRecompile: false,
      roomType: 'flow',
      entityId: flowId,
    };

    await this.loadFlowState(flowId, doc);

    this.rooms.set(flowId, room);
    this.logger.log(`Room criada para fluxo ${flowId}`);
    return room;
  }

  async getOrCreateComponentRoom(componentId: string): Promise<Room> {
    const roomKey = `component:${componentId}`;
    let room = this.rooms.get(roomKey);
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
      recompileTimer: null,
      cleanupTimer: null,
      pendingUpdates: [],
      needsRecompile: false,
      roomType: 'component',
      entityId: componentId,
    };

    await this.loadComponentState(componentId, doc);

    this.rooms.set(roomKey, room);
    this.logger.log(`Room criada para componente ${componentId}`);
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

  private async persistUpdates(roomKey: string, room: Room) {
    if (room.pendingUpdates.length === 0) return;

    const mergedUpdate = Y.mergeUpdates(room.pendingUpdates);
    room.pendingUpdates = [];

    try {
      if (room.roomType === 'component') {
        await this.prisma.yjsComponentUpdate.create({
          data: { componentId: room.entityId, update: Buffer.from(mergedUpdate) },
        });
        await this.syncComponentJsonFromDoc(room.entityId, room.doc);
        await this.compactComponentUpdatesIfNeeded(room.entityId);
        this.logger.debug(`Updates persistidos para componente ${room.entityId}`);
      } else {
        const flowId = room.entityId;
        await this.prisma.yjsUpdate.create({
          data: { flowId, update: Buffer.from(mergedUpdate) },
        });
        await this.syncFlowJsonFromDoc(flowId, room.doc);
        await this.compactUpdatesIfNeeded(flowId);
        room.needsRecompile = true;
        this.scheduleRecompile(roomKey, room);
        this.logger.debug(`Updates persistidos para fluxo ${flowId}`);
      }
    } catch (error) {
      this.logger.error(`Falha ao persistir updates da room ${roomKey}`, error);
      room.pendingUpdates.push(mergedUpdate);
    }
  }

  private scheduleRecompile(_roomKey: string, room: Room) {
    if (room.recompileTimer || room.roomType === 'component') return;
    room.recompileTimer = setTimeout(async () => {
      room.recompileTimer = null;
      await this.recompileFlow(room.entityId, room);
    }, RECOMPILE_DEBOUNCE_MS);
  }

  private async recompileFlow(flowId: string, room: Room) {
    if (!room.needsRecompile) return;
    room.needsRecompile = false;

    try {
      const nodesMap = room.doc.getMap('nodes');
      const connectionsMap = room.doc.getMap('connections');
      const variablesMap = room.doc.getMap('variables');
      const nodes = Array.from(nodesMap.values()) as any[];
      const connections = Array.from(connectionsMap.values()) as any[];
      const variables = Array.from(variablesMap.values()) as any[];

      if (nodes.length > 0 || connections.length > 0) {
        await this.flowService.recompilarFluxo(flowId, { nodes, connections, variables });
        this.logger.debug(`Fluxo ${flowId} recompilado`);
      }
    } catch (error) {
      this.logger.error(`Falha ao recompilar fluxo ${flowId}`, error);
      room.needsRecompile = true;
    }
  }

  private async syncFlowJsonFromDoc(flowId: string, doc: Y.Doc) {
    const nodesMap = doc.getMap('nodes');
    const connectionsMap = doc.getMap('connections');
    const variablesMap = doc.getMap('variables');
    const metaMap = doc.getMap('meta');

    const nodes = Array.from(nodesMap.values()) as any[];
    const connections = Array.from(connectionsMap.values()) as any[];
    const variables = Array.from(variablesMap.values()) as any[];

    const nome = metaMap.get('name') as string | undefined;
    const descricao = metaMap.get('description') as string | undefined;

    if (nodes.length > 0 || connections.length > 0) {
      const flowJson = { nodes, connections, variables };
      const updateData: any = { flowJson: flowJson as any };

      if (nome !== undefined && nome.trim() !== '') {
        updateData.nome = nome;
      }
      if (descricao !== undefined) {
        updateData.descricao = descricao;
      }

      await this.prisma.botFluxo.update({
        where: { id: flowId },
        data: updateData,
      });
    } else if (nome !== undefined && nome.trim() !== '') {
      // Persiste ao menos o nome/descrição mesmo quando o fluxo ainda está vazio
      const updateData: any = { nome };
      if (descricao !== undefined) updateData.descricao = descricao;
      await this.prisma.botFluxo.update({ where: { id: flowId }, data: updateData });
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
      select: { flowJson: true, nome: true, descricao: true },
    });

    if (fluxo?.flowJson) {
      const flowData = fluxo.flowJson as any;
      const nodesMap = doc.getMap('nodes');
      const connectionsMap = doc.getMap('connections');
      const variablesMap = doc.getMap('variables');
      const metaMap = doc.getMap('meta');

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
        metaMap.set('name', fluxo.nome);
        metaMap.set('description', fluxo.descricao || '');
      });

      this.logger.log(`Fluxo ${flowId} carregado do flow_json`);
    }
  }

  private async loadComponentState(componentId: string, doc: Y.Doc) {
    const updates = await this.prisma.yjsComponentUpdate.findMany({
      where: { componentId },
      orderBy: { criadoEm: 'asc' },
      select: { update: true },
    });

    if (updates.length > 0) {
      const merged = Y.mergeUpdates(
        updates.map((u) => new Uint8Array(u.update)),
      );
      Y.applyUpdate(doc, merged);
      this.logger.log(
        `Carregados ${updates.length} updates para componente ${componentId}`,
      );
      return;
    }

    // Fallback: load from nodes_json
    const comp = await this.prisma.componentePersonalizado.findUnique({
      where: { id: componentId },
      select: { nodesJson: true, nome: true, descricao: true },
    });

    if (comp?.nodesJson) {
      const data = comp.nodesJson as any;
      const nodesMap = doc.getMap('nodes');
      const connectionsMap = doc.getMap('connections');
      const metaMap = doc.getMap('meta');

      doc.transact(() => {
        for (const node of data.nodes || []) {
          nodesMap.set(node.id, node);
        }
        for (const conn of data.connections || []) {
          connectionsMap.set(conn.id, conn);
        }
        metaMap.set('name', comp.nome);
        metaMap.set('description', comp.descricao || '');
      });

      this.logger.log(`Componente ${componentId} carregado do nodes_json`);
    }
  }

  private async syncComponentJsonFromDoc(componentId: string, doc: Y.Doc) {
    const nodesMap = doc.getMap('nodes');
    const connectionsMap = doc.getMap('connections');
    const metaMap = doc.getMap('meta');

    const nodes = Array.from(nodesMap.values()) as any[];
    const connections = Array.from(connectionsMap.values()) as any[];

    const nome = metaMap.get('name') as string | undefined;
    const descricao = metaMap.get('description') as string | undefined;

    if (nodes.length > 0 || connections.length > 0) {
      const nodesJson = { nodes, connections };
      const updateData: any = { nodesJson: nodesJson as any };

      if (nome !== undefined && nome.trim() !== '') {
        updateData.nome = nome;
      }
      if (descricao !== undefined) {
        updateData.descricao = descricao;
      }

      await this.prisma.componentePersonalizado.update({
        where: { id: componentId },
        data: updateData,
      });
    }
  }

  private async compactComponentUpdatesIfNeeded(componentId: string) {
    const count = await this.prisma.yjsComponentUpdate.count({ where: { componentId } });
    if (count < 50) return;

    const allUpdates = await this.prisma.yjsComponentUpdate.findMany({
      where: { componentId },
      orderBy: { criadoEm: 'asc' },
      select: { id: true, update: true },
    });

    const merged = Y.mergeUpdates(
      allUpdates.map((u) => new Uint8Array(u.update)),
    );

    await this.prisma.$transaction([
      this.prisma.yjsComponentUpdate.deleteMany({ where: { componentId } }),
      this.prisma.yjsComponentUpdate.create({
        data: { componentId, update: Buffer.from(merged) },
      }),
    ]);

    this.logger.log(
      `Compactados ${allUpdates.length} updates em 1 para componente ${componentId}`,
    );
  }

  private async cleanupRoom(flowId: string) {
    const room = this.rooms.get(flowId);
    if (!room || room.connections.size > 0) return;

    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
      room.persistTimer = null;
    }
    if (room.recompileTimer) {
      clearTimeout(room.recompileTimer);
      room.recompileTimer = null;
    }

    await this.persistUpdates(flowId, room);
    // Force final recompile when room closes
    if (room.needsRecompile) {
      await this.recompileFlow(flowId, room);
    }
    room.doc.destroy();
    this.rooms.delete(flowId);
    this.logger.log(`Room limpa para fluxo ${flowId}`);
  }
}
