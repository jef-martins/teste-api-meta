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
  FlowJoined: 'flow-joined',
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
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private clientRooms = new Map<string, number>(); // clientId → flowId

  constructor(private collaborationService: CollaborationService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const flowId = this.clientRooms.get(client.id);
    if (flowId !== undefined) {
      this.collaborationService.removeConnection(flowId, client.id);
      this.clientRooms.delete(client.id);

      client.to(String(flowId)).emit(WsEvent.AwarenessUpdate, {
        clientId: client.id,
        removed: true,
      });
    }
    this.logger.log(`Client desconectado: ${client.id}`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WsEvent.JoinFlow)
  async handleJoinFlow(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { flowId: number },
  ) {
    const { flowId } = data;

    const previousRoom = this.clientRooms.get(client.id);
    if (previousRoom !== undefined) {
      client.leave(String(previousRoom));
      this.collaborationService.removeConnection(previousRoom, client.id);
    }

    try {
      const room = await this.collaborationService.getOrCreateRoom(flowId);
      client.join(String(flowId));
      this.clientRooms.set(client.id, flowId);
      this.collaborationService.addConnection(flowId, client.id);

      const stateVector = Y.encodeStateVector(room.doc);
      client.emit(WsEvent.FlowJoined, { flowId });
      client.emit(WsEvent.SyncStep1, { stateVector: Array.from(stateVector) });

      this.logger.log(`Client ${client.id} entrou no fluxo ${flowId}`);
    } catch (error) {
      this.logger.error(`Falha ao entrar no fluxo ${flowId}`, error);
      client.emit(WsEvent.FlowError, { message: 'Falha ao entrar no fluxo' });
    }
  }

  @SubscribeMessage(WsEvent.SyncStep1)
  handleSyncStep1(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { stateVector: number[] },
  ) {
    const flowId = this.clientRooms.get(client.id);
    if (flowId === undefined) return;

    const remoteStateVector = new Uint8Array(data.stateVector);
    const diff = this.collaborationService.getStateDiff(flowId, remoteStateVector);

    if (diff) {
      client.emit(WsEvent.SyncStep2, { update: Array.from(diff) });
    }
  }

  @SubscribeMessage(WsEvent.SyncStep2)
  handleSyncStep2(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { update: number[] },
  ) {
    const flowId = this.clientRooms.get(client.id);
    if (flowId === undefined) return;

    const update = new Uint8Array(data.update);
    this.collaborationService.applyUpdate(flowId, update);
  }

  @SubscribeMessage(WsEvent.Update)
  handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { update: number[] },
  ) {
    const flowId = this.clientRooms.get(client.id);
    if (flowId === undefined) return;

    const update = new Uint8Array(data.update);
    this.collaborationService.applyUpdate(flowId, update);

    // Broadcast to other clients in the same flow
    client.to(String(flowId)).emit(WsEvent.Update, { update: data.update });
  }

  @SubscribeMessage(WsEvent.AwarenessUpdate)
  handleAwarenessUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const flowId = this.clientRooms.get(client.id);
    if (flowId === undefined) return;

    client.to(String(flowId)).emit(WsEvent.AwarenessUpdate, {
      clientId: client.id,
      ...data,
    });
  }

  @SubscribeMessage(WsEvent.AwarenessQuery)
  handleAwarenessQuery(@ConnectedSocket() client: Socket) {
    const flowId = this.clientRooms.get(client.id);
    if (flowId === undefined) return;

    client.to(String(flowId)).emit(WsEvent.AwarenessQuery, {
      clientId: client.id,
    });
  }
}
