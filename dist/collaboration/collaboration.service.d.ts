import { OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';
import { PrismaService } from '../prisma/prisma.service';
interface Room {
    doc: Y.Doc;
    connections: Set<string>;
    persistTimer: ReturnType<typeof setTimeout> | null;
    cleanupTimer: ReturnType<typeof setTimeout> | null;
    pendingUpdates: Uint8Array[];
}
export declare class CollaborationService implements OnModuleDestroy {
    private prisma;
    private readonly logger;
    private rooms;
    constructor(prisma: PrismaService);
    onModuleDestroy(): Promise<void>;
    getOrCreateRoom(flowId: string): Promise<Room>;
    addConnection(flowId: string, clientId: string): void;
    removeConnection(flowId: string, clientId: string): void;
    getDoc(flowId: string): Y.Doc | null;
    getStateDiff(flowId: string, remoteStateVector: Uint8Array): Uint8Array | null;
    applyUpdate(flowId: string, update: Uint8Array): void;
    private schedulePersist;
    private persistUpdates;
    private syncFlowJsonFromDoc;
    private compactUpdatesIfNeeded;
    private loadFlowState;
    private cleanupRoom;
}
export {};
