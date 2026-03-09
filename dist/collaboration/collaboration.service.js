"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CollaborationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationService = void 0;
const common_1 = require("@nestjs/common");
const Y = __importStar(require("yjs"));
const prisma_service_1 = require("../prisma/prisma.service");
const PERSIST_DEBOUNCE_MS = 2000;
const ROOM_CLEANUP_TIMEOUT_MS = 30000;
let CollaborationService = CollaborationService_1 = class CollaborationService {
    prisma;
    logger = new common_1.Logger(CollaborationService_1.name);
    rooms = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleDestroy() {
        for (const [flowId, room] of this.rooms) {
            if (room.persistTimer)
                clearTimeout(room.persistTimer);
            if (room.cleanupTimer)
                clearTimeout(room.cleanupTimer);
            await this.persistUpdates(flowId, room);
            room.doc.destroy();
        }
        this.rooms.clear();
    }
    async getOrCreateRoom(flowId) {
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
    addConnection(flowId, clientId) {
        const room = this.rooms.get(flowId);
        if (room) {
            room.connections.add(clientId);
            this.logger.debug(`Client ${clientId} entrou na room ${flowId} (${room.connections.size} conectados)`);
        }
    }
    removeConnection(flowId, clientId) {
        const room = this.rooms.get(flowId);
        if (!room)
            return;
        room.connections.delete(clientId);
        this.logger.debug(`Client ${clientId} saiu da room ${flowId} (${room.connections.size} conectados)`);
        if (room.connections.size === 0) {
            room.cleanupTimer = setTimeout(() => {
                this.cleanupRoom(flowId);
            }, ROOM_CLEANUP_TIMEOUT_MS);
        }
    }
    getDoc(flowId) {
        return this.rooms.get(flowId)?.doc ?? null;
    }
    getStateDiff(flowId, remoteStateVector) {
        const doc = this.getDoc(flowId);
        if (!doc)
            return null;
        return Y.encodeStateAsUpdate(doc, remoteStateVector);
    }
    applyUpdate(flowId, update) {
        const room = this.rooms.get(flowId);
        if (!room)
            return;
        Y.applyUpdate(room.doc, update);
        room.pendingUpdates.push(update);
        this.schedulePersist(flowId, room);
    }
    schedulePersist(flowId, room) {
        if (room.persistTimer)
            return;
        room.persistTimer = setTimeout(async () => {
            room.persistTimer = null;
            await this.persistUpdates(flowId, room);
        }, PERSIST_DEBOUNCE_MS);
    }
    async persistUpdates(flowId, room) {
        if (room.pendingUpdates.length === 0)
            return;
        const mergedUpdate = Y.mergeUpdates(room.pendingUpdates);
        room.pendingUpdates = [];
        try {
            await this.prisma.yjsUpdate.create({
                data: { flowId, update: Buffer.from(mergedUpdate) },
            });
            await this.syncFlowJsonFromDoc(flowId, room.doc);
            await this.compactUpdatesIfNeeded(flowId);
            this.logger.debug(`Updates persistidos para fluxo ${flowId}`);
        }
        catch (error) {
            this.logger.error(`Falha ao persistir updates do fluxo ${flowId}`, error);
            room.pendingUpdates.push(mergedUpdate);
        }
    }
    async syncFlowJsonFromDoc(flowId, doc) {
        const nodesMap = doc.getMap('nodes');
        const connectionsMap = doc.getMap('connections');
        const variablesMap = doc.getMap('variables');
        const nodes = Array.from(nodesMap.values());
        const connections = Array.from(connectionsMap.values());
        const variables = Array.from(variablesMap.values());
        if (nodes.length > 0 || connections.length > 0) {
            await this.prisma.botFluxo.update({
                where: { id: flowId },
                data: { flowJson: { nodes, connections, variables } },
            });
        }
    }
    async compactUpdatesIfNeeded(flowId) {
        const count = await this.prisma.yjsUpdate.count({ where: { flowId } });
        if (count < 50)
            return;
        const allUpdates = await this.prisma.yjsUpdate.findMany({
            where: { flowId },
            orderBy: { criadoEm: 'asc' },
            select: { id: true, update: true },
        });
        const merged = Y.mergeUpdates(allUpdates.map((u) => new Uint8Array(u.update)));
        await this.prisma.$transaction([
            this.prisma.yjsUpdate.deleteMany({ where: { flowId } }),
            this.prisma.yjsUpdate.create({ data: { flowId, update: Buffer.from(merged) } }),
        ]);
        this.logger.log(`Compactados ${allUpdates.length} updates em 1 para fluxo ${flowId}`);
    }
    async loadFlowState(flowId, doc) {
        const updates = await this.prisma.yjsUpdate.findMany({
            where: { flowId },
            orderBy: { criadoEm: 'asc' },
            select: { update: true },
        });
        if (updates.length > 0) {
            const merged = Y.mergeUpdates(updates.map((u) => new Uint8Array(u.update)));
            Y.applyUpdate(doc, merged);
            this.logger.log(`Carregados ${updates.length} updates para fluxo ${flowId}`);
            return;
        }
        const fluxo = await this.prisma.botFluxo.findUnique({
            where: { id: flowId },
            select: { flowJson: true },
        });
        if (fluxo?.flowJson) {
            const flowData = fluxo.flowJson;
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
    async cleanupRoom(flowId) {
        const room = this.rooms.get(flowId);
        if (!room || room.connections.size > 0)
            return;
        if (room.persistTimer) {
            clearTimeout(room.persistTimer);
            room.persistTimer = null;
        }
        await this.persistUpdates(flowId, room);
        room.doc.destroy();
        this.rooms.delete(flowId);
        this.logger.log(`Room limpa para fluxo ${flowId}`);
    }
};
exports.CollaborationService = CollaborationService;
exports.CollaborationService = CollaborationService = CollaborationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CollaborationService);
//# sourceMappingURL=collaboration.service.js.map