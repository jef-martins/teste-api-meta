"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StateMachineEngine_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachineEngine = void 0;
const common_1 = require("@nestjs/common");
const estado_repository_1 = require("./estado.repository");
let StateMachineEngine = StateMachineEngine_1 = class StateMachineEngine {
    estadoRepo;
    logger = new common_1.Logger(StateMachineEngine_1.name);
    estadosUsuarios = new Map();
    dadosCapturados = new Map();
    mensagemAtual = '';
    nomeAtual = null;
    estadosAvisados = new Set();
    constructor(estadoRepo) {
        this.estadoRepo = estadoRepo;
    }
    interpolar(texto, variaveis = {}) {
        const normalizado = texto.replace(/\{\{([^}]+)\}\}/g, '{$1}');
        return normalizado.replace(/\{([^}]+)\}/g, (match, expr) => {
            const valor = this.resolverExprPath(expr.trim(), variaveis);
            return valor !== undefined && valor !== null ? String(valor) : match;
        });
    }
    resolverExprPath(expr, ctx) {
        const tokens = expr.replace(/\[(\d+)\]/g, '.$1').split('.');
        return tokens.reduce((acc, key) => {
            if (acc === undefined || acc === null)
                return undefined;
            return acc[key];
        }, ctx);
    }
    extrairValorPath(obj, path) {
        if (!path)
            return obj;
        const normalizado = path.replace(/\[(\d+)\]/g, '.$1');
        return normalizado.split('.').reduce((acc, key) => acc?.[key], obj) ?? '';
    }
    salvarDado(chatId, campo, valor) {
        const atual = this.dadosCapturados.get(chatId) ?? {};
        this.dadosCapturados.set(chatId, { ...atual, [campo]: valor });
    }
    obterDados(chatId) {
        return this.dadosCapturados.get(chatId) ?? {};
    }
    limparDados(chatId) {
        this.dadosCapturados.delete(chatId);
    }
    async process(message, chatId, entrada, nome, actionDelegate) {
        const estadoSalvo = await this.estadoRepo.obterEstadoUsuario(chatId);
        const estadoPadrao = await this.estadoRepo.obterEstadoInicial();
        this.estadosUsuarios.set(chatId, estadoSalvo ?? estadoPadrao);
        if (estadoSalvo && !this.estadosAvisados.has(chatId)) {
            this.logger.log(`[${chatId}] estado restaurado do banco: ${estadoSalvo}`);
            this.estadosAvisados.add(chatId);
        }
        const estadoAtual = this.estadosUsuarios.get(chatId);
        const config = await this.estadoRepo.obterConfigEstado(estadoAtual);
        if (!config) {
            this.logger.warn(`Estado "${estadoAtual}" não encontrado/ativo. Reiniciando para ${estadoPadrao}.`);
            await this.avancarEstado(chatId, estadoPadrao, entrada, nome);
            return;
        }
        this.logger.log(`[${chatId}] estado=${estadoAtual} → handler=${config.handler}`);
        this.mensagemAtual = entrada;
        this.nomeAtual = nome;
        if (config.config?.aguardarEntrada && entrada) {
            this.logger.log(`[${chatId}] estado aguarda entrada → buscando transição para "${entrada}"`);
            await this.transitarPorEntrada(chatId, estadoAtual, entrada, message, true, nome, actionDelegate);
            return;
        }
        if (typeof actionDelegate[config.handler] === 'function') {
            await actionDelegate[config.handler](message, chatId, entrada, this);
        }
        else {
            this.logger.error(`Handler "${config.handler}" não existe no Delegate!`);
        }
    }
    async avancarEstado(chatId, proximo, gatilho, nome) {
        const anterior = this.estadosUsuarios.get(chatId) ?? 'NOVO';
        this.estadosUsuarios.set(chatId, proximo);
        this.logger.log(`[${chatId}] transição: ${anterior} → ${proximo}`);
        this.estadoRepo.salvarEstadoUsuario(chatId, proximo, nome ?? this.nomeAtual).catch(() => { });
        this.estadoRepo.registrarTransicao(chatId, anterior, proximo, gatilho ?? this.mensagemAtual).catch(() => { });
    }
    async transitarPorEntrada(chatId, estadoAtual, entrada, message, executarHandler = true, nome = null, actionDelegate) {
        const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, entrada);
        if (!proximo)
            return null;
        await this.avancarEstado(chatId, proximo, this.mensagemAtual, nome);
        if (executarHandler && actionDelegate) {
            const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
            if (configProximo && typeof actionDelegate[configProximo.handler] === 'function') {
                await actionDelegate[configProximo.handler](message, chatId, '', this);
            }
        }
        return proximo;
    }
};
exports.StateMachineEngine = StateMachineEngine;
exports.StateMachineEngine = StateMachineEngine = StateMachineEngine_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [estado_repository_1.EstadoRepository])
], StateMachineEngine);
//# sourceMappingURL=state-machine.engine.js.map