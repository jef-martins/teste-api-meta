import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CollaborationService } from './collaboration.service';
export declare class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private collaborationService;
    server: Server;
    private readonly logger;
    private clientRooms;
    constructor(collaborationService: CollaborationService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinFlow(client: Socket, data: {
        flowId: number;
    }): Promise<void>;
    handleSyncStep1(client: Socket, data: {
        stateVector: number[];
    }): void;
    handleSyncStep2(client: Socket, data: {
        update: number[];
    }): void;
    handleUpdate(client: Socket, data: {
        update: number[];
    }): void;
    handleAwarenessUpdate(client: Socket, data: any): void;
    handleAwarenessQuery(client: Socket): void;
}
