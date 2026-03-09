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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listarEstados() {
        return this.prisma.botEstadoConfig.findMany({
            select: { estado: true, handler: true, descricao: true, ativo: true, config: true },
            orderBy: { estado: 'asc' },
        });
    }
    async criarEstado(data) {
        return this.prisma.botEstadoConfig.create({
            data: {
                estado: data.estado,
                handler: data.handler,
                descricao: data.descricao || '',
                config: data.config || {},
            },
        });
    }
    async atualizarEstado(estado, data) {
        return this.prisma.botEstadoConfig.update({
            where: { estado },
            data: {
                handler: data.handler,
                descricao: data.descricao || '',
                config: data.config || {},
                ativo: data.ativo !== false,
            },
        });
    }
    async excluirEstado(estado) {
        await this.prisma.botEstadoConfig.delete({ where: { estado } });
        return { ok: true };
    }
    async listarTransicoes() {
        return this.prisma.botEstadoTransicao.findMany({
            select: { id: true, estadoOrigem: true, entrada: true, estadoDestino: true, ativo: true },
            orderBy: [{ estadoOrigem: 'asc' }, { entrada: 'asc' }],
        });
    }
    async criarTransicao(data) {
        return this.prisma.botEstadoTransicao.create({
            data: {
                estadoOrigem: data.estado_origem,
                entrada: data.entrada,
                estadoDestino: data.estado_destino,
            },
        });
    }
    async atualizarTransicao(id, data) {
        return this.prisma.botEstadoTransicao.update({
            where: { id },
            data: {
                estadoOrigem: data.estado_origem,
                entrada: data.entrada,
                estadoDestino: data.estado_destino,
                ativo: data.ativo !== false,
            },
        });
    }
    async excluirTransicao(id) {
        await this.prisma.botEstadoTransicao.delete({ where: { id } });
        return { ok: true };
    }
    async testarRequisicao(data) {
        const { config, valor, variaveis } = data;
        if (!config?.url)
            throw new common_1.BadRequestException('URL não fornecida.');
        const interpolar = (texto, vars) => typeof texto === 'string' ? texto.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`) : texto;
        const interpolarDeep = (obj, vars) => {
            if (typeof obj === 'string')
                return interpolar(obj, vars);
            if (Array.isArray(obj))
                return obj.map((item) => interpolarDeep(item, vars));
            if (typeof obj === 'object' && obj !== null) {
                return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, interpolarDeep(v, vars)]));
            }
            return obj;
        };
        const metodo = (config.metodo || 'GET').toUpperCase();
        const tudo = { id: crypto.randomUUID(), valor: valor || '', ...(variaveis || {}) };
        const urlBase = interpolar(config.url, tudo);
        const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
        const usandoBodyFixo = config.body && typeof config.body === 'object' && !Array.isArray(config.body);
        let bodyObj;
        if (usandoBodyFixo) {
            bodyObj = interpolarDeep(config.body, tudo);
        }
        else if (config.campoEnviar && typeof config.campoEnviar === 'string') {
            bodyObj = { [config.campoEnviar]: valor || (variaveis?.valor) || '' };
        }
        else {
            bodyObj = { ...tudo };
        }
        try {
            let urlFinal = urlBase;
            const fetchOptions = { headers };
            if (metodo === 'GET') {
                if (!usandoBodyFixo) {
                    const params = new URLSearchParams(Object.fromEntries(Object.entries(bodyObj).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))).toString();
                    if (params)
                        urlFinal += (urlFinal.includes('?') ? '&' : '?') + params;
                }
            }
            else {
                fetchOptions.method = metodo;
                fetchOptions.body = JSON.stringify(bodyObj);
            }
            const response = await fetch(urlFinal, fetchOptions);
            const rsStr = await response.text();
            return { status: response.status, data: rsStr };
        }
        catch (err) {
            return { status: 500, erro: err.message };
        }
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map