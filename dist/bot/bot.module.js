"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotModule = void 0;
const common_1 = require("@nestjs/common");
const conversation_module_1 = require("../conversation/conversation.module");
const bot_service_1 = require("./bot.service");
const state_machine_engine_1 = require("./state-machine.engine");
const handler_service_1 = require("./handler.service");
const estado_repository_1 = require("./estado.repository");
let BotModule = class BotModule {
};
exports.BotModule = BotModule;
exports.BotModule = BotModule = __decorate([
    (0, common_1.Module)({
        imports: [conversation_module_1.ConversationModule],
        providers: [bot_service_1.BotService, state_machine_engine_1.StateMachineEngine, handler_service_1.HandlerService, estado_repository_1.EstadoRepository],
        exports: [bot_service_1.BotService],
    })
], BotModule);
//# sourceMappingURL=bot.module.js.map