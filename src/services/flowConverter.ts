// =============================================================================
// flowConverter.js
//
// Conversão bidirecional entre o formato do frontend (Flow Builder) e o
// formato do backend (máquina de estados: bot_estado_config + bot_estado_transicao).
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte texto para UPPER_SNAKE_CASE sem acentos.
 * Ex: "Menu Principal" → "MENU_PRINCIPAL"
 */
function toEstadoNameOg(label) {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9\s_]/g, '') // remove caracteres especiais
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();
}

/**
 * Garante nomes únicos adicionando sufixo _2, _3 etc.
 */
function uniqueName(baseName, existingNames) {
  if (!existingNames.has(baseName)) {
    existingNames.add(baseName);
    return baseName;
  }
  let i = 2;
  while (existingNames.has(`${baseName}_${i}`)) i++;
  const name = `${baseName}_${i}`;
  existingNames.add(name);
  return name;
}

/**
 * Converte variáveis do formato frontend {{var}} para backend {var}.
 */
function convertVariablesFtoBOg(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, '{$1}');
}

/**
 * Converte variáveis do formato backend {var} para frontend {{var}}.
 */
function convertVariablesBtoFOg(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{(\w+(?:\.\w+)*)\}/g, '{{$1}}');
}

/**
 * Aplica conversão de variáveis recursivamente em objetos/arrays.
 */
function convertVariablesDeep(obj, converter) {
  if (typeof obj === 'string') return converter(obj);
  if (Array.isArray(obj))
    return obj.map((item) => convertVariablesDeep(item, converter));
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        convertVariablesDeep(v, converter),
      ]),
    );
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontend → Backend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte um fluxo do frontend para estados e transições do backend.
 *
 * @param {object} flowJson - JSON exportado pelo frontend (nodes, connections, variables)
 * @returns {{ estados: Array, transicoes: Array, variaveis: Array }}
 */
function flowToStateMachineOg(flowJson) {
  const { nodes = [], connections = [], variables = [] } = flowJson;

  const existingNames = new Set();
  const nodeIdToEstado = new Map(); // nodeId → nome do estado

  // ── Passo 1: Converter nodes → estados ──
  const estados = nodes.map((node) => {
    const label = node.properties?.label || node.type;
    const baseName = toEstadoNameOg(label);
    const estadoName = uniqueName(baseName, existingNames);

    nodeIdToEstado.set(node.id, estadoName);

    const { handler, config } = nodeToHandlerConfig(node);

    return {
      estado: estadoName,
      handler,
      descricao: label,
      ativo: true,
      config: convertVariablesDeep(config, convertVariablesFtoBOg),
      node_id: node.id,
      node_type: node.type,
      position: node.position || { x: 0, y: 0 },
    };
  });

  // ── Passo 2: Converter connections → transições ──
  const transicoes = connections
    .map((conn) => {
      const estadoOrigem = nodeIdToEstado.get(conn.sourceNodeId);
      const estadoDestino = nodeIdToEstado.get(conn.targetNodeId);

      if (!estadoOrigem || !estadoDestino) return null;

      const entrada = connectionToEntrada(conn, nodes);

      return {
        estado_origem: estadoOrigem,
        entrada,
        estado_destino: estadoDestino,
        ativo: true,
      };
    })
    .filter(Boolean);

  // ── Passo 3: Variáveis ──
  const vars = variables.map((v) => ({
    key: v.key,
    value: v.value || '',
  }));

  return { estados, transicoes, variaveis: vars };
}

/**
 * Determina handler e config para um nó com base no tipo e subComponents.
 */
function nodeToHandlerConfig(node) {
  const props = node.properties || {};
  const subs = props.subComponents || [];

  switch (node.type) {
    case 'start':
      return {
        handler: '_handlerMensagem',
        config: { mensagens: [], transicaoAutomatica: true },
      };

    case 'message':
      return messageNodeToHandler(props, subs);

    case 'decision':
      return decisionNodeToHandler(props);

    case 'action':
      return actionNodeToHandler(props, subs);

    case 'delay': {
      const duration = props.duration || 1;
      const unit = props.unit || 'seconds';
      // Converter unidade do frontend para o handler
      const unidade =
        unit === 'minutes' || unit === 'hours' || unit === 'days'
          ? 'minutes'
          : 'seconds';
      let duracao = duration;
      if (unit === 'hours') duracao = duration * 60;
      if (unit === 'days') duracao = duration * 1440;
      return {
        handler: '_handlerDelay',
        config: { duracao, unidade },
      };
    }

    case 'end': {
      // mensagemFim: campo dedicado no frontend. Vazio = não envia nada.
      const msgFim = props.mensagemFim && props.mensagemFim.trim();
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

function messageNodeToHandler(props, subs) {
  const sendMessages = subs.filter((s) => s.type === 'sendMessage');
  const waitForResp = subs.find((s) => s.type === 'waitForResponse');

  if (waitForResp) {
    // Captura de entrada do usuário
    const mensagens = sendMessages
      .map((s) => s.properties?.content)
      .filter(Boolean);
    const mensagemPedir = mensagens[0] || props.content || '';

    return {
      handler: '_handlerCapturar',
      config: {
        mensagemPedir,
        campoSalvar: waitForResp.properties?.responseVariable || 'valor',
      },
    };
  }

  // Apenas envia mensagens
  const mensagens =
    sendMessages.length > 0
      ? sendMessages.map((s) => s.properties?.content).filter(Boolean)
      : props.content
        ? [props.content]
        : [];

  return {
    handler: '_handlerMensagem',
    config: {
      mensagens,
      transicaoAutomatica: true,
    },
  };
}

function decisionNodeToHandler(props) {
  const conditions = props.conditions || [];

  // Monta opções a partir das conditions do decision node
  const opcoes = conditions.map((cond, idx) => ({
    entrada: cond.value || String(idx + 1),
    label: cond.value || `Opção ${idx + 1}`,
  }));

  if (opcoes.length <= 3) {
    return {
      handler: '_handlerBotoes',
      config: {
        titulo: props.label || 'Escolha uma opção:',
        botoes: opcoes,
      },
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

function actionNodeToHandler(props, subs) {
  const apiCall = subs.find(
    (s) => s.type === 'apiCall' || s.type === 'webhook',
  );
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
    // Multi-campo set
    return {
      handler: '_handlerCapturar',
      config: {
        campos: assignments.map((a) => ({ nome: a.key, mensagemPedir: '' })),
        transicaoAutomatica: true,
      },
    };
  }

  // Fallback: nó action sem subcomponents configurados (legado)
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

/**
 * Determina a entrada (trigger) de uma transição com base na conexão.
 */
function connectionToEntrada(conn, nodes) {
  const sourceNode = nodes.find((n) => n.id === conn.sourceNodeId);
  if (!sourceNode) return '*';

  // Decision nodes: usar label da conexão ou valor da condition
  if (sourceNode.type === 'decision') {
    if (conn.label && conn.label.trim()) {
      return conn.label.trim();
    }
    // output-0 = primeira opção, output-1 = segunda, etc.
    const portMatch = conn.sourcePort?.match(/^output-(\d+)$/);
    if (portMatch) {
      const idx = parseInt(portMatch[1], 10);
      const conditions = sourceNode.properties?.conditions || [];
      if (conditions[idx]?.value) {
        return conditions[idx].value;
      }
      return String(idx + 1);
    }
    if (conn.sourcePort === 'output-default') return '*';
    return conn.label || '*';
  }

  // Para nós com transição automática (start, message sem wait, delay)
  return '*';
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend → Frontend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte estados e transições do backend para o formato do frontend.
 *
 * @param {Array} estados    - Registros de bot_estado_config
 * @param {Array} transicoes - Registros de bot_estado_transicao
 * @param {Array} variaveis  - Registros de bot_fluxo_variaveis
 * @returns {{ nodes: Array, connections: Array, variables: Array }}
 */
function stateMachineToFlowOg(
  estados: any[],
  transicoes: any[],
  variaveis: any[] = [],
) {
  const estadoToNodeId = new Map();

  // ── Passo 1: Converter estados → nodes ──
  const nodes = estados.map((e, idx) => {
    const nodeId = e.node_id || `node-imported-${idx}`;
    estadoToNodeId.set(e.estado, nodeId);

    const nodeType = e.node_type || handlerToNodeType(e.handler, e.config);
    const position = e.position || { x: 200, y: idx * 150 };
    const properties = handlerConfigToProperties(
      nodeType,
      e.handler,
      e.config,
      e.estado,
    );

    return {
      id: nodeId,
      type: nodeType,
      position,
      properties: convertVariablesDeep(properties, convertVariablesBtoFOg),
    };
  });

  // ── Passo 2: Converter transições → connections ──
  let connIdx = 0;
  const connections = transicoes
    .map((t) => {
      const sourceNodeId = estadoToNodeId.get(t.estado_origem);
      const targetNodeId = estadoToNodeId.get(t.estado_destino);

      if (!sourceNodeId || !targetNodeId) return null;

      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      const sourcePort = transicaoToSourcePort(t, sourceNode, transicoes);

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

  // ── Passo 3: Variáveis ──
  const vars = variaveis.map((v, idx) => ({
    id: `var-imported-${idx}`,
    key: v.chave,
    value: v.valor_padrao || '',
  }));

  return { nodes, connections, variables: vars };
}

/**
 * Determina o tipo de nó do frontend com base no handler.
 */
function handlerToNodeType(handler, config) {
  switch (handler) {
    case '_handlerMensagem':
      if (
        config?.transicaoAutomatica &&
        (!config.mensagens || config.mensagens.length === 0)
      ) {
        return 'start';
      }
      if (config?.aguardarEntrada) return 'end';
      return 'message';

    case '_handlerCapturar':
      return 'message'; // message com waitForResponse

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

/**
 * Converte handler + config do backend para properties do frontend.
 */
function handlerConfigToProperties(nodeType, handler, config, estadoName) {
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
        // Message com waitForResponse
        const subComponents: any[] = [];
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
          properties: {
            responseVariable: config.campoSalvar || 'valor',
          },
        });
        return {
          label: estadoName || 'Message',
          channel: 'whatsapp',
          content: '',
          variables: [],
          subComponents,
        };
      }

      // handlerMensagem simples
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
      return {
        label: config.titulo || estadoName || 'Decision',
        conditions,
      };
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
        } else if (duration >= 60) {
          duration = duration / 60;
          unit = 'hours';
        } else {
          unit = 'minutes';
        }
      }
      return {
        label: estadoName || 'Delay',
        duration,
        unit,
      };
    }

    default:
      return { label: estadoName || 'Node' };
  }
}

/**
 * Determina o sourcePort com base na transição.
 */
function transicaoToSourcePort(transicao, sourceNode, todasTransicoes) {
  if (!sourceNode || sourceNode.type !== 'decision') {
    return 'output';
  }

  if (transicao.entrada === '*') return 'output-default';

  // Encontra o índice desta transição entre as transições do mesmo estado_origem
  const transicoesDoEstado = todasTransicoes
    .filter(
      (t) => t.estado_origem === transicao.estado_origem && t.entrada !== '*',
    )
    .sort((a, b) => a.entrada.localeCompare(b.entrada));

  const idx = transicoesDoEstado.findIndex(
    (t) => t.entrada === transicao.entrada,
  );
  return `output-${idx >= 0 ? idx : 0}`;
}

export const flowToStateMachine = flowToStateMachineOg;
export const stateMachineToFlow = stateMachineToFlowOg;
export const toEstadoName = toEstadoNameOg;
export const convertVariablesFtoB = convertVariablesFtoBOg;
export const convertVariablesBtoF = convertVariablesBtoFOg;
