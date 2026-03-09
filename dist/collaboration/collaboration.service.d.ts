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
    getOrCreateRoom(flowId: number): Promise<Room>;
    addConnection(flowId: number, clientId: string): void;
    removeConnection(flowId: number, clientId: string): void;
    getDoc(flowId: number): Y.Doc | null;
    getStateDiff(flowId: number, remoteStateVector: Uint8Array): Uint8Array | null;
    applyUpdate(flowId: number, update: Uint8Array): void;
    private schedulePersist;
    private persistUpdates;
    private syncFlowJsonFromDoc;
    private compactUpdatesIfNeeded;
    private loadFlowState;
    private cleanupRoom;
}
export {};
