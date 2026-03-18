"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowConverterService = void 0;
const common_1 = require("@nestjs/common");
let FlowConverterService = class FlowConverterService {
    toEstadoName(label) {
        return label
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9\s_]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .toUpperCase();
    }
    uniqueName(baseName, existing) {
        if (!existing.has(baseName)) {
            existing.add(baseName);
            return baseName;
        }
        let i = 2;
        while (existing.has(`${baseName}_${i}`))
            i++;
        const name = `${baseName}_${i}`;
        existing.add(name);
        return name;
    }
    convertVariablesFtoB(text) {
        if (typeof text !== 'string')
            return text;
        return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, '{$1}');
    }
    convertVariablesBtoF(text) {
        if (typeof text !== 'string')
            return text;
        return text.replace(/\{(\w+(?:\.\w+)*)\}/g, '{{$1}}');
    }
    convertVariablesDeep(obj, converter) {
        if (typeof obj === 'string')
            return converter(obj);
        if (Array.isArray(obj))
            return obj.map((item) => this.convertVariablesDeep(item, converter));
        if (typeof obj === 'object' && obj !== null) {
            return Object.fromEntries(Object.entries(obj).map(([k, v]) => [
                k,
                this.convertVariablesDeep(v, converter),
            ]));
        }
        return obj;
    }
    flowToStateMachine(flowJson) {
        const { nodes = [], connections = [], variables = [] } = flowJson;
        const existingNames = new Set();
        const nodeIdToEstado = new Map();
        const estados = nodes.map((node) => {
            const label = node.properties?.label || node.type;
            const baseName = this.toEstadoName(label);
            const estadoName = this.uniqueName(baseName, existingNames);
            nodeIdToEstado.set(node.id, estadoName);
            const { handler, config } = this.nodeToHandlerConfig(node);
            return {
                estado: estadoName,
                handler,
                descricao: label,
                ativo: true,
                config: this.convertVariablesDeep(config, this.convertVariablesFtoB.bind(this)),
                node_id: node.id,
                node_type: node.type,
                position: node.position || { x: 0, y: 0 },
            };
        });
        const transicoes = connections
            .map((conn) => {
            const estadoOrigem = nodeIdToEstado.get(conn.sourceNodeId);
            const estadoDestino = nodeIdToEstado.get(conn.targetNodeId);
            if (!estadoOrigem || !estadoDestino)
                return null;
            const entrada = this.connectionToEntrada(conn, nodes);
            return {
                estado_origem: estadoOrigem,
                entrada,
                estado_destino: estadoDestino,
                ativo: true,
            };
        })
            .filter(Boolean);
        const vars = variables.map((v) => ({
            key: v.key,
            value: v.value || '',
        }));
        return { estados, transicoes, variaveis: vars };
    }
    nodeToHandlerConfig(node) {
        const props = node.properties || {};
        const subs = props.subComponents || [];
        switch (node.type) {
            case 'start':
                return {
                    handler: '_handlerMensagem',
                    config: { mensagens: [], transicaoAutomatica: true },
                };
            case 'message':
                return this.messageNodeToHandler(props, subs);
            case 'decision':
                return this.decisionNodeToHandler(props);
            case 'action':
                return this.actionNodeToHandler(props, subs);
            case 'delay': {
                const duration = props.duration || 1;
                const unit = props.unit || 'seconds';
                let duracao = duration;
                if (unit === 'hours')
                    duracao = duration * 60;
                if (unit === 'days')
                    duracao = duration * 1440;
                const unidade = unit === 'minutes' || unit === 'hours' || unit === 'days'
                    ? 'minutes'
                    : 'seconds';
                return { handler: '_handlerDelay', config: { duracao, unidade } };
            }
            case 'end': {
                const msgFim = props.mensagemFim?.trim();
                return {
                    handler: '_handlerMensagem',
                    config: {
                        mensagens: msgFim ? [msgFim] : [],
                        aguardarEntrada: true,
                        transicaoAutomatica: false,
                    },
                };
            }
            default:
                return {
                    handler: '_handlerMensagem',
                    config: { mensagens: [], transicaoAutomatica: true },
                };
        }
    }
    messageNodeToHandler(props, subs) {
        const sendMessages = subs.filter((s) => s.type === 'sendMessage');
        const waitForResp = subs.find((s) => s.type === 'waitForResponse');
        if (waitForResp) {
            const mensagens = sendMessages
                .map((s) => s.properties?.content)
                .filter(Boolean);
            return {
                handler: '_handlerCapturar',
                config: {
                    mensagemPedir: mensagens[0] || props.content || '',
                    campoSalvar: waitForResp.properties?.responseVariable || 'valor',
                },
            };
        }
        const mensagens = sendMessages.length > 0
            ? sendMessages.map((s) => s.properties?.content).filter(Boolean)
            : props.content
                ? [props.content]
                : [];
        return {
            handler: '_handlerMensagem',
            config: { mensagens, transicaoAutomatica: true },
        };
    }
    decisionNodeToHandler(props) {
        const conditions = props.conditions || [];
        const opcoes = conditions.map((cond, idx) => ({
            entrada: cond.value || String(idx + 1),
            label: cond.value || `Opção ${idx + 1}`,
        }));
        if (opcoes.length <= 3) {
            return {
                handler: '_handlerBotoes',
                config: { titulo: props.label || 'Escolha uma opção:', botoes: opcoes },
            };
        }
        return {
            handler: '_handlerLista',
            config: {
                titulo: props.label || 'Escolha uma opção:',
                botaoTexto: 'Selecione:',
                secaoTitulo: 'Opções',
                opcoes,
            },
        };
    }
    actionNodeToHandler(props, subs) {
        const apiCall = subs.find((s) => s.type === 'apiCall' || s.type === 'webhook');
        const setVar = subs.find((s) => s.type === 'setVariable');
        if (apiCall) {
            const p = apiCall.properties || {};
            return {
                handler: '_handlerRequisicao',
                config: {
                    url: p.endpoint || p.url || '',
                    metodo: (p.method || 'GET').toUpperCase(),
                    headers: p.headers || {},
                    body: p.body || undefined,
                    campoResposta: p.responseVariable || 'data',
                    transicaoAutomatica: true,
                },
            };
        }
        if (setVar) {
            const assignments = setVar.properties?.assignments || [];
            if (assignments.length === 1) {
                return {
                    handler: '_handlerCapturar',
                    config: {
                        campoSalvar: assignments[0].key || 'valor',
                        transicaoAutomatica: true,
                    },
                };
            }
            return {
                handler: '_handlerCapturar',
                config: {
                    campos: assignments.map((a) => ({
                        nome: a.key,
                        mensagemPedir: '',
                    })),
                    transicaoAutomatica: true,
                },
            };
        }
        if (props.endpoint) {
            return {
                handler: '_handlerRequisicao',
                config: {
                    url: props.endpoint,
                    metodo: (props.method || 'GET').toUpperCase(),
                    headers: props.headers || {},
                    body: props.body || undefined,
                    transicaoAutomatica: true,
                },
            };
        }
        return {
            handler: '_handlerMensagem',
            config: { mensagens: [], transicaoAutomatica: true },
        };
    }
    connectionToEntrada(conn, nodes) {
        const sourceNode = nodes.find((n) => n.id === conn.sourceNodeId);
        if (!sourceNode)
            return '*';
        if (sourceNode.type === 'decision') {
            if (conn.label?.trim())
                return conn.label.trim();
            const portMatch = conn.sourcePort?.match(/^output-(\d+)$/);
            if (portMatch) {
                const idx = parseInt(portMatch[1], 10);
                const conditions = sourceNode.properties?.conditions || [];
                if (conditions[idx]?.value)
                    return conditions[idx].value;
                return String(idx + 1);
            }
            if (conn.sourcePort === 'output-default')
                return '*';
            return conn.label || '*';
        }
        return '*';
    }
    stateMachineToFlow(estados, transicoes, variaveis = []) {
        const estadoToNodeId = new Map();
        const nodes = estados.map((e, idx) => {
            const nodeId = e.node_id || `node-imported-${idx}`;
            estadoToNodeId.set(e.estado, nodeId);
            const nodeType = e.node_type || this.handlerToNodeType(e.handler, e.config);
            const position = e.position || { x: 200, y: idx * 150 };
            const properties = this.handlerConfigToProperties(nodeType, e.handler, e.config, e.estado);
            return {
                id: nodeId,
                type: nodeType,
                position,
                properties: this.convertVariablesDeep(properties, this.convertVariablesBtoF.bind(this)),
            };
        });
        let connIdx = 0;
        const connections = transicoes
            .map((t) => {
            const sourceNodeId = estadoToNodeId.get(t.estado_origem);
            const targetNodeId = estadoToNodeId.get(t.estado_destino);
            if (!sourceNodeId || !targetNodeId)
                return null;
            const sourceNode = nodes.find((n) => n.id === sourceNodeId);
            const sourcePort = this.transicaoToSourcePort(t, sourceNode, transicoes);
            return {
                id: `conn-imported-${connIdx++}`,
                sourceNodeId,
                targetNodeId,
                sourcePort,
                targetPort: 'input',
                label: t.entrada === '*' ? '' : t.entrada,
                condition: null,
            };
        })
            .filter(Boolean);
        const vars = variaveis.map((v, idx) => ({
            id: `var-imported-${idx}`,
            key: v.chave,
            value: v.valor_padrao || '',
        }));
        return { nodes, connections, variables: vars };
    }
    handlerToNodeType(handler, config) {
        switch (handler) {
            case '_handlerMensagem':
                if (config?.transicaoAutomatica &&
                    (!config.mensagens || config.mensagens.length === 0))
                    return 'start';
                if (config?.aguardarEntrada)
                    return 'end';
                return 'message';
            case '_handlerCapturar':
                return 'message';
            case '_handlerLista':
            case '_handlerBotoes':
                return 'decision';
            case '_handlerRequisicao':
                return 'action';
            case '_handlerDelay':
                return 'delay';
            default:
                return 'message';
        }
    }
    handlerConfigToProperties(nodeType, handler, config, estadoName) {
        config = config || {};
        switch (nodeType) {
            case 'start':
                return { label: estadoName || 'Start' };
            case 'end':
                return {
                    label: estadoName || 'End',
                    mensagemFim: config.mensagens?.[0] || '',
                };
            case 'message': {
                if (handler === '_handlerCapturar') {
                    const subComponents = [];
                    if (config.mensagemPedir) {
                        subComponents.push({
                            id: `sub-${Date.now()}-sm`,
                            type: 'sendMessage',
                            properties: {
                                content: config.mensagemPedir,
                                channel: 'whatsapp',
                            },
                        });
                    }
                    subComponents.push({
                        id: `sub-${Date.now()}-wr`,
                        type: 'waitForResponse',
                        properties: { responseVariable: config.campoSalvar || 'valor' },
                    });
                    return {
                        label: estadoName || 'Message',
                        channel: 'whatsapp',
                        content: '',
                        variables: [],
                        subComponents,
                    };
                }
                const mensagens = config.mensagens || [];
                const subComponents = mensagens.map((msg, i) => ({
                    id: `sub-${Date.now()}-${i}`,
                    type: 'sendMessage',
                    properties: { content: msg, channel: 'whatsapp' },
                }));
                return {
                    label: estadoName || 'Message',
                    channel: 'whatsapp',
                    content: '',
                    variables: [],
                    subComponents,
                };
            }
            case 'decision': {
                const items = config.opcoes || config.botoes || [];
                const conditions = items.map((item, i) => ({
                    id: `cond-${Date.now()}-${i}`,
                    field: '',
                    operator: 'equals',
                    value: item.entrada || String(i + 1),
                }));
                return { label: config.titulo || estadoName || 'Decision', conditions };
            }
            case 'action': {
                const subComponents = [
                    {
                        id: `sub-${Date.now()}-api`,
                        type: 'apiCall',
                        properties: {
                            endpoint: config.url || '',
                            method: config.metodo || 'GET',
                            headers: config.headers || {},
                            body: config.body || '',
                            responseVariable: config.campoResposta || '',
                        },
                    },
                ];
                return {
                    label: estadoName || 'Action',
                    actionType: 'api_call',
                    endpoint: '',
                    method: 'GET',
                    headers: {},
                    body: '',
                    subComponents,
                };
            }
            case 'delay': {
                let duration = config.duracao || 1;
                let unit = 'seconds';
                if (config.unidade === 'minutes') {
                    if (duration >= 1440) {
                        duration = duration / 1440;
                        unit = 'days';
                    }
                    else if (duration >= 60) {
                        duration = duration / 60;
                        unit = 'hours';
                    }
                    else {
                        unit = 'minutes';
                    }
                }
                return { label: estadoName || 'Delay', duration, unit };
            }
            default:
                return { label: estadoName || 'Node' };
        }
    }
    transicaoToSourcePort(transicao, sourceNode, todasTransicoes) {
        if (!sourceNode || sourceNode.type !== 'decision')
            return 'output';
        if (transicao.entrada === '*')
            return 'output-default';
        const transicoesDoEstado = todasTransicoes
            .filter((t) => t.estado_origem === transicao.estado_origem && t.entrada !== '*')
            .sort((a, b) => a.entrada.localeCompare(b.entrada));
        const idx = transicoesDoEstado.findIndex((t) => t.entrada === transicao.entrada);
        return `output-${idx >= 0 ? idx : 0}`;
    }
};
exports.FlowConverterService = FlowConverterService;
exports.FlowConverterService = FlowConverterService = __decorate([
    (0, common_1.Injectable)()
], FlowConverterService);
//# sourceMappingURL=flow-converter.service.js.map