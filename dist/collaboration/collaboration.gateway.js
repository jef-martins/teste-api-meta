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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CollaborationGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const Y = __importStar(require("yjs"));
const collaboration_service_1 = require("./collaboration.service");
const ws_auth_guard_1 = require("../auth/ws-auth.guard");
const WsEvent = {
    JoinFlow: 'join-flow',
    FlowJoined: 'flow-joined',
    FlowError: 'flow-error',
    SyncStep1: 'sync-step-1',
    SyncStep2: 'sync-step-2',
    Update: 'update',
    AwarenessUpdate: 'awareness-update',
    AwarenessQuery: 'awareness-query',
};
let CollaborationGateway = CollaborationGateway_1 = class CollaborationGateway {
    collaborationService;
    server;
    logger = new common_1.Logger(CollaborationGateway_1.name);
    clientRooms = new Map();
    constructor(collaborationService) {
        this.collaborationService = collaborationService;
    }
    handleConnection(client) {
        this.logger.log(`Client conectado: ${client.id}`);
    }
    async handleDisconnect(client) {
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
    async handleJoinFlow(client, data) {
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
        }
        catch (error) {
            this.logger.error(`Falha ao entrar no fluxo ${flowId}`, error);
            client.emit(WsEvent.FlowError, { message: 'Falha ao entrar no fluxo' });
        }
    }
    handleSyncStep1(client, data) {
        const flowId = this.clientRooms.get(client.id);
        if (flowId === undefined)
            return;
        const remoteStateVector = new Uint8Array(data.stateVector);
        const diff = this.collaborationService.getStateDiff(flowId, remoteStateVector);
        if (diff) {
            client.emit(WsEvent.SyncStep2, { update: Array.from(diff) });
        }
    }
    handleSyncStep2(client, data) {
        const flowId = this.clientRooms.get(client.id);
        if (flowId === undefined)
            return;
        const update = new Uint8Array(data.update);
        this.collaborationService.applyUpdate(flowId, update);
    }
    handleUpdate(client, data) {
        const flowId = this.clientRooms.get(client.id);
        if (flowId === undefined)
            return;
        const update = new Uint8Array(data.update);
        this.collaborationService.applyUpdate(flowId, update);
        client.to(String(flowId)).emit(WsEvent.Update, { update: data.update });
    }
    handleAwarenessUpdate(client, data) {
        const flowId = this.clientRooms.get(client.id);
        if (flowId === undefined)
            return;
        client.to(String(flowId)).emit(WsEvent.AwarenessUpdate, {
            clientId: client.id,
            ...data,
        });
    }
    handleAwarenessQuery(client) {
        const flowId = this.clientRooms.get(client.id);
        if (flowId === undefined)
            return;
        client.to(String(flowId)).emit(WsEvent.AwarenessQuery, {
            clientId: client.id,
        });
    }
};
exports.CollaborationGateway = CollaborationGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], CollaborationGateway.prototype, "server", void 0);
__decorate([
    (0, common_1.UseGuards)(ws_auth_guard_1.WsAuthGuard),
    (0, websockets_1.SubscribeMessage)(WsEvent.JoinFlow),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], CollaborationGateway.prototype, "handleJoinFlow", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(WsEvent.SyncStep1),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], CollaborationGateway.prototype, "handleSyncStep1", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(WsEvent.SyncStep2),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], CollaborationGateway.prototype, "handleSyncStep2", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(WsEvent.Update),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], CollaborationGateway.prototype, "handleUpdate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(WsEvent.AwarenessUpdate),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], CollaborationGateway.prototype, "handleAwarenessUpdate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(WsEvent.AwarenessQuery),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], CollaborationGateway.prototype, "handleAwarenessQuery", null);
exports.CollaborationGateway = CollaborationGateway = CollaborationGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/collaboration',
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [collaboration_service_1.CollaborationService])
], CollaborationGateway);
//# sourceMappingURL=collaboration.gateway.js.map