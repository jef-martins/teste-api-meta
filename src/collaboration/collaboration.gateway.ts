import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { CollaborationService } from './collaboration.service';
import { WsAuthGuard } from '../auth/ws-auth.guard';

// WebSocket event names
const WsEvent = {
  JoinFlow: 'join-flow',
  JoinComponent: 'join-component',
  FlowJoined: 'flow-joined',
  ComponentJoined: 'component-joined',
  FlowError: 'flow-error',
  SyncStep1: 'sync-step-1',
  SyncStep2: 'sync-step-2',
  Update: 'update',
  AwarenessUpdate: 'awareness-update',
  AwarenessQuery: 'awareness-query',
} as const;

@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private clientRooms = new Map<string, { id: string; type: 'flow' | 'component' }>(); // clientId → room info

  constructor(private collaborationService: CollaborationService) { }

  handleConnection(client: Socket) {
    this.logger.log(`Client conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const roomInfo = this.clientRooms.get(client.id);
    if (roomInfo !== undefined) {
      const roomKey = this.roomKey(roomInfo);
      this.collaborationService.removeConnection(roomKey, client.id);
      this.clientRooms.delete(client.id);

      client.to(roomKey).emit(WsEvent.AwarenessUpdate, {
        clientId: client.id,
        removed: true,
      });
    }
    this.logger.log(`Client desconectado: ${client.id}`);
  }

  /** Build a unique room key to avoid collisions between flow and component IDs */
  private roomKey(info: { id: string; type: 'flow' | 'component' }): string {
    return info.type === 'component' ? `component:${info.id}` : info.id;
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WsEvent.JoinFlow)
  async handleJoinFlow(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { flowId: string },
  ) {
    const { flowId } = data;
    await this.leaveCurrentRoom(client);

    try {
      const room = await this.collaborationService.getOrCreateRoom(flowId);
      client.join(flowId);
      this.clientRooms.set(client.id, { id: flowId, type: 'flow' });
      this.collaborationService.addConnection(flowId, client.id);

      const stateVector = Y.encodeStateVector(room.doc);
      client.emit(WsEvent.FlowJoined, { flowId });
      client.emit(WsEvent.SyncStep1, stateVector);

      this.logger.log(`Client ${client.id} entrou no fluxo ${flowId}`);
    } catch (error) {
      this.logger.error(`Falha ao entrar no fluxo ${flowId}`, error);
      client.emit(WsEvent.FlowError, { message: 'Falha ao entrar no fluxo' });
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WsEvent.JoinComponent)
  async handleJoinComponent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { componentId: string },
  ) {
    const { componentId } = data;
    await this.leaveCurrentRoom(client);

    const roomKey = this.roomKey({ id: componentId, type: 'component' });

    try {
      const room = await this.collaborationService.getOrCreateComponentRoom(componentId);
      client.join(roomKey);
      this.clientRooms.set(client.id, { id: componentId, type: 'component' });
      this.collaborationService.addConnection(roomKey, client.id);

      const stateVector = Y.encodeStateVector(room.doc);
      client.emit(WsEvent.ComponentJoined, { componentId });
      client.emit(WsEvent.SyncStep1, stateVector);

      this.logger.log(`Client ${client.id} entrou no componente ${componentId}`);
    } catch (error) {
      this.logger.error(`Falha ao entrar no componente ${componentId}`, error);
      client.emit(WsEvent.FlowError, { message: 'Falha ao entrar no componente' });
    }
  }

  private async leaveCurrentRoom(client: Socket) {
    const prev = this.clientRooms.get(client.id);
    if (prev !== undefined) {
      const prevKey = this.roomKey(prev);
      client.leave(prevKey);
      this.collaborationService.removeConnection(prevKey, client.id);
    }
  }

  /** Convert incoming data to Uint8Array (supports both binary and legacy JSON array) */
  private toUint8Array(data: any): Uint8Array {
    if (data instanceof Buffer || data instanceof Uint8Array) return new Uint8Array(data);
    if (data?.update) return this.toUint8Array(data.update);
    if (data?.stateVector) return this.toUint8Array(data.stateVector);
    if (Array.isArray(data)) return new Uint8Array(data);
    return new Uint8Array(data);
  }

  @SubscribeMessage(WsEvent.SyncStep1)
  handleSyncStep1(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const roomKey = this.getClientRoomKey(client.id);
    if (!roomKey) return;

    const remoteStateVector = this.toUint8Array(data);
    const diff = this.collaborationService.getStateDiff(
      roomKey,
      remoteStateVector,
    );

    if (diff) {
      client.emit(WsEvent.SyncStep2, diff);
    }
  }

  @SubscribeMessage(WsEvent.SyncStep2)
  handleSyncStep2(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const roomKey = this.getClientRoomKey(client.id);
    if (!roomKey) return;

    const update = this.toUint8Array(data);
    this.collaborationService.applyUpdate(roomKey, update);
  }

  @SubscribeMessage(WsEvent.Update)
  handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const roomKey = this.getClientRoomKey(client.id);
    if (!roomKey) return;

    const update = this.toUint8Array(data);
    this.collaborationService.applyUpdate(roomKey, update);

    client.to(roomKey).emit(WsEvent.Update, update);
  }

  @SubscribeMessage(WsEvent.AwarenessUpdate)
  handleAwarenessUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const roomKey = this.getClientRoomKey(client.id);
    if (!roomKey) return;

    client.to(roomKey).emit(WsEvent.AwarenessUpdate, {
      clientId: client.id,
      ...data,
    });
  }

  @SubscribeMessage(WsEvent.AwarenessQuery)
  handleAwarenessQuery(@ConnectedSocket() client: Socket) {
    const roomKey = this.getClientRoomKey(client.id);
    if (!roomKey) return;

    client.to(roomKey).emit(WsEvent.AwarenessQuery, {
      clientId: client.id,
    });
  }

  private getClientRoomKey(clientId: string): string | null {
    const info = this.clientRooms.get(clientId);
    return info ? this.roomKey(info) : null;
  }
}
