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
var HandlerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandlerService = void 0;
const common_1 = require("@nestjs/common");
const estado_repository_1 = require("./estado.repository");
const crypto = __importStar(require("crypto"));
let HandlerService = HandlerService_1 = class HandlerService {
    estadoRepo;
    logger = new common_1.Logger(HandlerService_1.name);
    client = null;
    constructor(estadoRepo) {
        this.estadoRepo = estadoRepo;
    }
    async enviarResposta(message, texto) {
        if (!this.client) {
            this.logger.error('Client não inicializado');
            return;
        }
        try {
            const destino = message.from;
            await this.client.sendText(destino, texto);
            this.logger.log(`Resposta enviada para ${destino}`);
        }
        catch (err) {
            this.logger.error(`Erro ao enviar resposta: ${err.message}`);
        }
    }
    async _handlerMensagem(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config = (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};
        const mensagens = config.mensagens ?? [];
        const dadosChat = engine.obterDados(chatId);
        for (const texto of mensagens) {
            const textoInterpolado = engine.interpolar(texto, dadosChat);
            await this.enviarResposta(message, textoInterpolado);
        }
        if (config.transicaoAutomatica || config.transicao_automatica) {
            await engine.transitarPorEntrada(chatId, estadoAtual, '*', message, true, null, this);
        }
    }
    async _handlerCapturar(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config = (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};
        if (Array.isArray(config.campos) && config.campos.length > 0) {
            return this._handlerCapturarMulti(message, chatId, corpo, estadoAtual, config, engine);
        }
        if (!corpo) {
            if (config.mensagemPedir) {
                await this.enviarResposta(message, config.mensagemPedir);
            }
            return;
        }
        let proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, corpo);
        if (!proximo &&
            (config.transicaoAutomatica || config.transicao_automatica)) {
            proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
        }
        if (!proximo) {
            const msgInvalida = config.mensagemInvalida ?? '⚠️ Resposta inválida. Tente novamente.';
            await this.enviarResposta(message, msgInvalida);
            return;
        }
        const chave = config.campoSalvar || config.campoEnviar;
        if (chave)
            engine.salvarDado(chatId, chave, corpo);
        if (config.mensagemConfirmacao) {
            const texto = engine.interpolar(config.mensagemConfirmacao, {
                valor: corpo,
            });
            await this.enviarResposta(message, texto);
        }
        await engine.avancarEstado(chatId, proximo, corpo);
        const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
        if (configProximo &&
            typeof this[configProximo.handler] === 'function') {
            await this[configProximo.handler](message, chatId, '', engine);
        }
    }
    async _handlerCapturarMulti(message, chatId, corpo, estadoAtual, config, engine) {
        const campos = config.campos;
        const dados = engine.obterDados(chatId);
        const proximoCampo = campos.find((c) => !(c.nome in dados));
        if (!proximoCampo)
            return;
        if (!corpo) {
            await this.enviarResposta(message, proximoCampo.mensagemPedir);
            return;
        }
        if (Array.isArray(proximoCampo.valoresAceitos) &&
            !proximoCampo.valoresAceitos.includes(corpo)) {
            const msgInvalida = proximoCampo.mensagemInvalida ??
                config.mensagemInvalida ??
                '⚠️ Resposta inválida. Tente novamente.';
            await this.enviarResposta(message, msgInvalida);
            return;
        }
        engine.salvarDado(chatId, proximoCampo.nome, corpo);
        const dadosAtualizados = engine.obterDados(chatId);
        const proximoCampoRestante = campos.find((c) => !(c.nome in dadosAtualizados));
        if (proximoCampoRestante) {
            await this.enviarResposta(message, proximoCampoRestante.mensagemPedir);
            return;
        }
        if (config.mensagemConfirmacao) {
            const texto = engine.interpolar(config.mensagemConfirmacao, dadosAtualizados);
            await this.enviarResposta(message, texto);
        }
        const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
        if (!proximo)
            return;
        await engine.avancarEstado(chatId, proximo, '[multi-captura concluída]');
        const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
        if (configProximo &&
            typeof this[configProximo.handler] === 'function') {
            await this[configProximo.handler](message, chatId, '', engine);
        }
    }
    async _handlerLista(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        let config = (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};
        if (typeof config === 'string')
            config = JSON.parse(config);
        if (corpo) {
            const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, corpo);
            if (proximo) {
                await engine.avancarEstado(chatId, proximo, corpo);
                const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
                if (configProximo &&
                    typeof this[configProximo.handler] === 'function') {
                    return await this[configProximo.handler](message, chatId, '', engine);
                }
            }
            else {
                return await this.enviarResposta(message, config.mensagemInvalida ?? '⚠️ Opção inválida.');
            }
        }
        const destino = message.from;
        const opcoes = config.opcoes ?? [];
        const titulo = config.titulo ?? 'Menu';
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('sendListMessage timeout após 5s')), 5000));
        try {
            await Promise.race([
                this.client.sendListMessage(destino, {
                    buttonText: config.botaoTexto || 'Selecione:',
                    description: titulo,
                    sections: [
                        {
                            title: config.secaoTitulo || 'Opções',
                            rows: opcoes.map((op) => ({
                                rowId: String(op.entrada),
                                title: op.label,
                                description: op.descricao || '',
                            })),
                        },
                    ],
                    footer: config.rodape || '',
                }),
                timeout,
            ]);
        }
        catch (err) {
            this.logger.warn(`[${chatId}] Fallback texto — motivo: ${err.message}`);
            const linhas = opcoes
                .map((o) => `*${o.entrada}* - ${o.label}`)
                .join('\n');
            await this.enviarResposta(message, `${titulo}\n\n${linhas}`);
        }
    }
    async _handlerBotoes(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config = (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};
        if (corpo) {
            const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, corpo);
            if (proximo) {
                await engine.avancarEstado(chatId, proximo, corpo);
                const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
                if (configProximo &&
                    typeof this[configProximo.handler] === 'function') {
                    await this[configProximo.handler](message, chatId, '', engine);
                }
                return;
            }
        }
        try {
            await this.client.sendText(message.from, config.titulo ?? 'Escolha uma opção:', {
                useTemplateButtons: true,
                title: config.cabecalho ?? undefined,
                footer: config.rodape ?? undefined,
                buttons: (config.botoes ?? []).map((b) => ({
                    id: b.entrada,
                    text: b.label,
                })),
            });
        }
        catch (err) {
            this.logger.error(`Erro ao enviar botões: ${err.message}`);
            const linhas = (config.botoes ?? []).map((b) => b.label).join('\n');
            await this.enviarResposta(message, `${config.titulo ?? ''}\n\n${linhas}`);
        }
    }
    async _handlerRequisicao(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config = (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};
        const dadosMemoria = engine.obterDados(chatId);
        const usandoBodyFixo = config.body &&
            typeof config.body === 'object' &&
            !Array.isArray(config.body);
        const usandoMulti = Array.isArray(config.camposEnviar) && config.camposEnviar.length > 0;
        const palavraSair = (config.palavraSair ?? 'sair').toLowerCase();
        if (corpo && corpo.toLowerCase() === palavraSair) {
            const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, corpo);
            if (proximo) {
                engine.limparDados(chatId);
                await engine.avancarEstado(chatId, proximo, corpo);
                const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
                if (configProximo &&
                    typeof this[configProximo.handler] === 'function') {
                    await this[configProximo.handler](message, chatId, '', engine);
                }
                return;
            }
        }
        if (!corpo &&
            !usandoBodyFixo &&
            !usandoMulti &&
            Object.keys(dadosMemoria).length === 0) {
            if (config.mensagemPedir) {
                await this.enviarResposta(message, config.mensagemPedir);
                return;
            }
        }
        let valorParaTransicao = '*';
        try {
            const metodo = (config.metodo ?? 'GET').toUpperCase();
            const from = message.from ?? chatId;
            const numero = from.split('@')[0];
            const tudo = {
                id: crypto.randomUUID(),
                valor: corpo,
                chatId,
                from,
                numero,
                ...dadosMemoria,
            };
            const urlBase = engine.interpolar(config.url ?? '', tudo);
            const headers = {
                'Content-Type': 'application/json',
                ...(config.headers ?? {}),
            };
            const interpolarDeep = (obj) => {
                if (typeof obj === 'string')
                    return engine.interpolar(obj, tudo);
                if (Array.isArray(obj))
                    return obj.map((item) => interpolarDeep(item));
                if (typeof obj === 'object' && obj !== null) {
                    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, interpolarDeep(v)]));
                }
                return obj;
            };
            let bodyObj;
            if (usandoBodyFixo) {
                bodyObj = interpolarDeep(config.body);
            }
            else if (usandoMulti) {
                bodyObj = Object.fromEntries(config.camposEnviar.map((chave) => [
                    chave,
                    dadosMemoria[chave] ?? '',
                ]));
            }
            else if (config.campoEnviar && typeof config.campoEnviar === 'string') {
                bodyObj = {
                    [config.campoEnviar]: dadosMemoria[config.campoEnviar] ?? corpo,
                };
            }
            else {
                bodyObj = { valor: corpo };
            }
            let resposta;
            let statusHttp;
            if (metodo === 'GET') {
                let urlFinal = urlBase;
                if (!usandoBodyFixo) {
                    const params = new URLSearchParams(Object.fromEntries(Object.entries(bodyObj)
                        .filter(([, v]) => v !== undefined && v !== '')
                        .map(([k, v]) => [k, String(v)]))).toString();
                    if (params)
                        urlFinal += (urlFinal.includes('?') ? '&' : '?') + params;
                }
                const res = await fetch(urlFinal, { headers });
                statusHttp = res.status;
                resposta = await res.json();
            }
            else {
                const res = await fetch(urlBase, {
                    method: metodo,
                    headers,
                    body: JSON.stringify(bodyObj),
                });
                statusHttp = res.status;
                resposta = await res.json();
            }
            if (statusHttp !== 200) {
                await this.enviarResposta(message, config.mensagemErro ?? '❌ Erro ao processar a solicitação.');
            }
            else {
                const valorExtraido = engine.extrairValorPath(resposta, config.campoResposta);
                if (valorExtraido === '' ||
                    valorExtraido === null ||
                    valorExtraido === undefined) {
                    await this.enviarResposta(message, config.mensagemNaoEncontrado ?? '🤷‍♂️ Não encontrado.');
                }
                else if (Array.isArray(valorExtraido)) {
                    if (valorExtraido.length === 0) {
                        await this.enviarResposta(message, config.mensagemNaoEncontrado ?? '🤷‍♂️ Não encontrado.');
                    }
                    else {
                        const separador = config.separador ?? '➖➖➖➖➖';
                        const partes = valorExtraido.map((item) => {
                            const objLimpo = Object.fromEntries(Object.entries(item).map(([k, v]) => [
                                k,
                                typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').trim() : v,
                            ]));
                            const vars = {
                                resposta: item,
                                valor: corpo,
                                ...dadosMemoria,
                                ...objLimpo,
                            };
                            return engine.interpolar(config.mensagemSucesso ?? '✅ {resposta}', vars);
                        });
                        await this.enviarResposta(message, partes.join(`\n\n${separador}\n\n`));
                    }
                }
                else {
                    if (typeof valorExtraido !== 'object') {
                        valorParaTransicao = String(valorExtraido).toLowerCase();
                    }
                    let variaveis = {
                        resposta: valorExtraido,
                        valor: corpo,
                        ...dadosMemoria,
                    };
                    if (typeof valorExtraido === 'object' && valorExtraido !== null) {
                        const objLimpo = Object.fromEntries(Object.entries(valorExtraido).map(([k, v]) => [
                            k,
                            typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').trim() : v,
                        ]));
                        variaveis = { ...variaveis, ...objLimpo };
                    }
                    const msgSucesso = engine.interpolar(config.mensagemSucesso ?? '✅ Resposta: {resposta}', variaveis);
                    await this.enviarResposta(message, msgSucesso);
                }
            }
        }
        catch (err) {
            this.logger.error(`Erro na requisição: ${err.message}`);
            await this.enviarResposta(message, config.mensagemErro ?? '❌ Erro ao processar a solicitação.');
        }
        if (config.limparDados !== false &&
            (usandoBodyFixo || usandoMulti || config.campoSalvar)) {
            engine.limparDados(chatId);
        }
        if (config.transicaoAutomatica || config.transicao_automatica) {
            let proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, valorParaTransicao);
            if (!proximo && valorParaTransicao !== '*') {
                proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
            }
            if (proximo) {
                await engine.avancarEstado(chatId, proximo, corpo);
                const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
                if (configProximo &&
                    typeof this[configProximo.handler] === 'function') {
                    await this[configProximo.handler](message, chatId, '', engine);
                }
            }
        }
    }
    async _handlerDelay(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config = (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};
        const duracao = config.duracao || 1;
        const unidade = config.unidade || 'seconds';
        const multiplicador = unidade === 'minutes' ? 60000 : 1000;
        const ms = duracao * multiplicador;
        if (config.mensagem) {
            await this.enviarResposta(message, config.mensagem);
        }
        const tempoReal = Math.min(ms, 300000);
        await new Promise((resolve) => setTimeout(resolve, tempoReal));
        const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
        if (proximo) {
            await engine.avancarEstado(chatId, proximo, '[delay]');
            const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
            if (configProximo &&
                typeof this[configProximo.handler] === 'function') {
                await this[configProximo.handler](message, chatId, '', engine);
            }
        }
    }
};
exports.HandlerService = HandlerService;
exports.HandlerService = HandlerService = HandlerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [estado_repository_1.EstadoRepository])
], HandlerService);
//# sourceMappingURL=handler.service.js.map