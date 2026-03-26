import { Injectable } from '@nestjs/common';

type JsonObject = Record<string, unknown>;

type Position = {
  x: number;
  y: number;
};

export type FlowVariable = {
  id?: string;
  key?: string;
  value?: string;
  chave?: string;
  valor_padrao?: string;
  [key: string]: unknown;
};

export type FlowSubComponent = {
  id?: string;
  type?: string;
  properties?: JsonObject;
  [key: string]: unknown;
};

type ChoiceItem = {
  id?: string;
  entrada?: string;
  label?: string;
  descricao?: string;
  value?: string;
  key?: string;
  name?: string;
  [key: string]: unknown;
};

export type FlowNodeProperties = JsonObject & {
  label?: string;
  content?: string;
  titulo?: string;
  cabecalho?: string;
  rodape?: string;
  botaoTexto?: string;
  secaoTitulo?: string;
  mensagemFim?: string;
  duration?: number;
  unit?: string;
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  botoes?: ChoiceItem[];
  opcoes?: ChoiceItem[];
  conditions?: ChoiceItem[];
  assignments?: ChoiceItem[];
  subComponents?: FlowSubComponent[];
  internalNodes?: FlowNode[];
  internalConnections?: FlowConnection[];
  responseVariable?: string;
  campoSalvar?: string;
  mensagens?: string[];
  transicaoAutomatica?: boolean;
  aguardarEntrada?: boolean;
  mensagemPedir?: string;
  url?: string;
  metodo?: string;
  campoResposta?: string;
  apiId?: string | null;
  routeId?: string | null;
  variavelResposta?: string;
  config?: FlowNodeProperties | JsonObject;
  duracao?: number;
  unidade?: string;
};

export type FlowNode = {
  id: string;
  type: string;
  position: Position;
  properties?: FlowNodeProperties;
  node_id?: string;
  node_type?: string;
  [key: string]: unknown;
};

export type FlowConnection = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePort?: string;
  targetPort?: string;
  label?: string;
  condition?: unknown;
  [key: string]: unknown;
};

export type FlowJsonPayload = {
  nodes?: FlowNode[];
  connections?: FlowConnection[];
  variables?: FlowVariable[];
};

export type EstadoConfigOutput = {
  estado: string;
  handler: string;
  descricao: string;
  ativo: boolean;
  config: JsonObject;
  node_id: string;
  node_type: string;
  position: Position;
};

export type TransicaoOutput = {
  estado_origem: string;
  entrada: string;
  estado_destino: string;
  ativo: boolean;
};
@Injectable()
export class FlowConverterService {
  // ─── Utilitários ─────────────────────────────────────────────────────────

  toEstadoName(label: string): string {
    return label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s_]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .toUpperCase();
  }

  private uniqueName(baseName: string, existing: Set<string>): string {
    if (!existing.has(baseName)) {
      existing.add(baseName);
      return baseName;
    }
    let i = 2;
    while (existing.has(`${baseName}_${i}`)) i++;
    const name = `${baseName}_${i}`;
    existing.add(name);
    return name;
  }

  convertVariablesFtoB(text: string): string {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, '{$1}');
  }

  convertVariablesBtoF(text: string): string {
    if (typeof text !== 'string') return text;
    return text.replace(/\{(\w+(?:\.\w+)*)\}/g, '{{$1}}');
  }

  private convertVariablesDeep(
    obj: unknown,
    converter: (s: string) => string,
  ): unknown {
    if (typeof obj === 'string') return converter(obj);
    if (Array.isArray(obj))
      return obj.map((item) => this.convertVariablesDeep(item, converter));
    if (typeof obj === 'object' && obj !== null) {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
          k,
          this.convertVariablesDeep(v, converter),
        ]),
      );
    }
    return obj;
  }

  // ─── Frontend → Backend ──────────────────────────────────────────────────

  /**
   * Flatten customComponent nodes into their internal nodes/connections
   */
  private flattenCustomComponents(
    nodes: FlowNode[],
    connections: FlowConnection[],
  ): { nodes: FlowNode[]; connections: FlowConnection[] } {
    const flatNodes: FlowNode[] = [];
    const flatConnections = connections.map((c) => ({ ...c }));
    let hasCustom = false;

    for (const node of nodes) {
      if (node.type === 'customComponent') {
        hasCustom = true;
        const internalNodes = node.properties?.internalNodes || [];
        const internalConnections = node.properties?.internalConnections || [];

        // Generate new IDs to avoid collisions
        const idMap: Record<string, string> = {};
        for (const iNode of internalNodes) {
          idMap[iNode.id] = `${node.id}_${iNode.id}`;
        }

        // Add internal nodes with remapped IDs and adjusted positions
        const centerX =
          internalNodes.reduce(
            (s: number, n: FlowNode) => s + n.position.x,
            0,
          ) / (internalNodes.length || 1);
        const centerY =
          internalNodes.reduce(
            (s: number, n: FlowNode) => s + n.position.y,
            0,
          ) / (internalNodes.length || 1);

        for (const iNode of internalNodes) {
          flatNodes.push({
            ...iNode,
            id: idMap[iNode.id],
            position: {
              x: node.position.x + (iNode.position.x - centerX),
              y: node.position.y + (iNode.position.y - centerY),
            },
          });
        }

        // Add internal connections with remapped IDs
        for (const iConn of internalConnections) {
          flatConnections.push({
            ...iConn,
            id: `${node.id}_${iConn.id}`,
            sourceNodeId: idMap[iConn.sourceNodeId] || iConn.sourceNodeId,
            targetNodeId: idMap[iConn.targetNodeId] || iConn.targetNodeId,
          });
        }

        // Entry node: first internal node with no incoming internal connections
        const entryNode = internalNodes.find(
          (n: FlowNode) =>
            !internalConnections.some(
              (c: FlowConnection) => c.targetNodeId === n.id,
            ),
        );
        // Exit node: last internal node with no outgoing internal connections
        const exitNode = internalNodes.find(
          (n: FlowNode) =>
            !internalConnections.some(
              (c: FlowConnection) => c.sourceNodeId === n.id,
            ),
        );

        // Remap external connections that pointed to/from this customComponent
        for (const conn of flatConnections) {
          if (conn.sourceNodeId === node.id) {
            // Connection comes FROM the component → remap to exit node
            if (exitNode) conn.sourceNodeId = idMap[exitNode.id];
          }
          if (conn.targetNodeId === node.id) {
            // Connection goes INTO the component → remap to entry node
            if (entryNode) conn.targetNodeId = idMap[entryNode.id];
          }
        }
      } else {
        flatNodes.push(node);
      }
    }

    if (!hasCustom) return { nodes, connections };
    // Recurse to flatten further nested customComponent nodes that were inside internalNodes
    return this.flattenCustomComponents(flatNodes, flatConnections);
  }

  flowToStateMachine(flowJson: FlowJsonPayload): {
    estados: EstadoConfigOutput[];
    transicoes: TransicaoOutput[];
    variaveis: Array<{ key: string | undefined; value: string }>;
  } {
    let { nodes = [], connections = [], variables = [] } = flowJson;

    // Flatten customComponent nodes before processing
    const flattened = this.flattenCustomComponents(nodes, connections);
    nodes = flattened.nodes;
    connections = flattened.connections;

    const existingNames = new Set<string>();
    const nodeIdToEstado = new Map<string, string>();

    const estados = nodes.map((node: FlowNode) => {
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
        config: this.convertVariablesDeep(
          config,
          this.convertVariablesFtoB.bind(this),
        ) as JsonObject,
        node_id: node.id,
        node_type: node.type,
        position: node.position || { x: 0, y: 0 },
      };
    });

    const transicoes = connections
      .map((conn: FlowConnection) => {
        const estadoOrigem = nodeIdToEstado.get(conn.sourceNodeId);
        const estadoDestino = nodeIdToEstado.get(conn.targetNodeId);
        if (!estadoOrigem || !estadoDestino) return null;

        const entrada = this.connectionToEntrada(conn, nodes);
        return {
          estado_origem: estadoOrigem,
          entrada,
          estado_destino: estadoDestino,
          ativo: true,
        };
      })
      .filter((conn): conn is TransicaoOutput => conn !== null);

    const vars = variables.map((v: FlowVariable) => ({
      key: v.key,
      value: v.value || '',
    }));

    return { estados, transicoes, variaveis: vars };
  }

  private nodeToHandlerConfig(node: FlowNode) {
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

      case 'buttons': {
        const botoes = (props.botoes || []).map((b: ChoiceItem) => ({
          entrada: b.entrada || b.label || '',
          label: b.label || b.entrada || '',
        }));
        return {
          handler: '_handlerBotoes',
          config: {
            titulo: props.titulo || props.label || '',
            ...(props.cabecalho ? { cabecalho: props.cabecalho } : {}),
            ...(props.rodape ? { rodape: props.rodape } : {}),
            botoes,
          },
        };
      }

      case 'listMenu': {
        const opcoes = (props.opcoes || []).map((o: ChoiceItem) => ({
          entrada: o.entrada || o.label || '',
          label: o.label || o.entrada || '',
          ...(o.descricao ? { descricao: o.descricao } : {}),
        }));
        return {
          handler: '_handlerLista',
          config: {
            titulo: props.titulo || props.label || '',
            botaoTexto: props.botaoTexto || 'Ver opções',
            secaoTitulo: props.secaoTitulo || 'Opções',
            ...(props.rodape ? { rodape: props.rodape } : {}),
            opcoes,
          },
        };
      }

      case 'action':
        return this.actionNodeToHandler(props, subs);

      case 'delay': {
        const duration = props.duration || 1;
        const unit = props.unit || 'seconds';
        let duracao = duration;
        if (unit === 'hours') duracao = duration * 60;
        if (unit === 'days') duracao = duration * 1440;
        const unidade =
          unit === 'minutes' || unit === 'hours' || unit === 'days'
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

  private messageNodeToHandler(
    props: FlowNodeProperties,
    subs: FlowSubComponent[],
  ) {
    const sendMessages = subs.filter(
      (s: FlowSubComponent) => s.type === 'sendMessage',
    );
    const waitForResp = subs.find(
      (s: FlowSubComponent) => s.type === 'waitForResponse',
    );
    const setVars = subs.filter(
      (s: FlowSubComponent) => s.type === 'setVariable',
    );

    // Coletar assignments de todos os setVariable sub-componentes
    const assignments: ChoiceItem[] = [];
    for (const sv of setVars) {
      const svAssignments = (sv.properties?.assignments as ChoiceItem[]) || [];
      for (const a of svAssignments) {
        if (a.key || a.name) {
          assignments.push({ key: a.key || a.name, value: a.value || '' });
        }
      }
    }

    if (waitForResp) {
      const mensagens = sendMessages
        .map((s: FlowSubComponent) => s.properties?.content)
        .filter(Boolean);
      const config: JsonObject = {
        mensagemPedir: mensagens[0] || props.content || '',
        campoSalvar: waitForResp.properties?.responseVariable || 'valor',
      };
      if (assignments.length > 0) {
        config.assignments = assignments;
      }
      return {
        handler: '_handlerCapturar',
        config,
      };
    }

    const mensagens =
      sendMessages.length > 0
        ? sendMessages
            .map((s: FlowSubComponent) => s.properties?.content)
            .filter(Boolean)
        : props.content
          ? [props.content]
          : [];

    const config: JsonObject = { mensagens, transicaoAutomatica: true };
    if (assignments.length > 0) {
      config.assignments = assignments;
    }

    return {
      handler: '_handlerMensagem',
      config,
    };
  }

  private decisionNodeToHandler(props: FlowNodeProperties) {
    const conditions = props.conditions || [];
    const opcoes = conditions.map((cond: ChoiceItem, idx: number) => ({
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

  private actionNodeToHandler(
    props: FlowNodeProperties,
    subs: FlowSubComponent[],
  ) {
    const apiRoute = subs.find((s: FlowSubComponent) => s.type === 'apiRoute');
    const apiCall = subs.find(
      (s: FlowSubComponent) => s.type === 'apiCall' || s.type === 'webhook',
    );
    const integration = subs.find(
      (s: FlowSubComponent) => s.type === 'integration',
    );
    const setVar = subs.find((s: FlowSubComponent) => s.type === 'setVariable');

    if (apiRoute) {
      const p = apiRoute.properties || {};
      return {
        handler: '_handlerRequisicao',
        config: {
          apiId: p.apiId || null,
          routeId: p.routeId || null,
          variavelResposta: p.responseVariable || 'resposta',
          transicaoAutomatica: true,
        },
      };
    }

    if (apiCall) {
      const p = (apiCall.properties || {}) as FlowNodeProperties;
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

    if (integration) {
      const p = (integration.properties || {}) as FlowNodeProperties;
      const cfg = (p.config || {}) as FlowNodeProperties;
      return {
        handler: '_handlerRequisicao',
        config: {
          url: cfg.endpoint || '',
          metodo: (cfg.method || 'POST').toUpperCase(),
          headers: cfg.headers || {},
          body: cfg.body || undefined,
          variavelResposta: p.responseVariable || 'integrationResponse',
          transicaoAutomatica: true,
        },
      };
    }

    if (setVar) {
      const rawAssignments = (setVar.properties?.assignments as ChoiceItem[]) || [];
      const assignments = rawAssignments.map((a: ChoiceItem) => ({
        key: a.key || a.name || 'valor',
        value: a.value || '',
      }));
      return {
        handler: '_handlerSetVariable',
        config: { assignments },
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

  private connectionToEntrada(conn: FlowConnection, nodes: FlowNode[]): string {
    const sourceNode = nodes.find((n: FlowNode) => n.id === conn.sourceNodeId);
    if (!sourceNode) return '*';

    if (sourceNode.type === 'decision') {
      if (conn.label?.trim()) return conn.label.trim();
      const portMatch = conn.sourcePort?.match(/^output-(\d+)$/);
      if (portMatch) {
        const idx = parseInt(portMatch[1], 10);
        const conditions = sourceNode.properties?.conditions || [];
        if (conditions[idx]?.value) return conditions[idx].value;
        return String(idx + 1);
      }
      if (conn.sourcePort === 'output-default') return '*';
      return conn.label || '*';
    }

    if (sourceNode.type === 'buttons') {
      if (conn.label?.trim()) return conn.label.trim();
      if (conn.sourcePort === 'output-default') return '*';
      const portMatch = conn.sourcePort?.match(/^output-(\d+)$/);
      if (portMatch) {
        const idx = parseInt(portMatch[1], 10);
        const botoes = sourceNode.properties?.botoes || [];
        return botoes[idx]?.entrada || botoes[idx]?.label || String(idx + 1);
      }
      return conn.label || '*';
    }

    if (sourceNode.type === 'listMenu') {
      if (conn.label?.trim()) return conn.label.trim();
      if (conn.sourcePort === 'output-default') return '*';
      const portMatch = conn.sourcePort?.match(/^output-(\d+)$/);
      if (portMatch) {
        const idx = parseInt(portMatch[1], 10);
        const opcoes = sourceNode.properties?.opcoes || [];
        return opcoes[idx]?.entrada || opcoes[idx]?.label || String(idx + 1);
      }
      return conn.label || '*';
    }

    return '*';
  }

  // ─── Backend → Frontend ──────────────────────────────────────────────────

  stateMachineToFlow(
    estados: EstadoConfigOutput[],
    transicoes: TransicaoOutput[],
    variaveis: FlowVariable[] = [],
  ) {
    const estadoToNodeId = new Map<string, string>();

    const nodes: FlowNode[] = estados.map((e: EstadoConfigOutput, idx: number) => {
      const nodeId = e.node_id || `node-imported-${idx}`;
      estadoToNodeId.set(e.estado, nodeId);

      const nodeType =
        e.node_type || this.handlerToNodeType(e.handler, e.config as FlowNodeProperties);
      const position = e.position || { x: 200, y: idx * 150 };
      const properties = this.handlerConfigToProperties(
        nodeType,
        e.handler,
        e.config,
        e.estado,
      );

      return {
        id: nodeId,
        type: nodeType,
        position,
        properties: this.convertVariablesDeep(
          properties,
          this.convertVariablesBtoF.bind(this),
        ) as FlowNodeProperties,
      };
    });

    let connIdx = 0;
    const connections: FlowConnection[] = transicoes
      .map((t: TransicaoOutput): FlowConnection | null => {
        const sourceNodeId = estadoToNodeId.get(t.estado_origem);
        const targetNodeId = estadoToNodeId.get(t.estado_destino);
        if (!sourceNodeId || !targetNodeId) return null;

        const sourceNode = nodes.find((n: FlowNode) => n.id === sourceNodeId);
        const sourcePort = this.transicaoToSourcePort(
          t,
          sourceNode,
          transicoes,
        );

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
      .filter((conn): conn is FlowConnection => conn !== null);

    const vars = variaveis.map((v: FlowVariable, idx: number) => ({
      id: `var-imported-${idx}`,
      key: v.chave,
      value: v.valor_padrao || '',
    }));

    return { nodes, connections, variables: vars };
  }

  private handlerToNodeType(handler: string, config: FlowNodeProperties): string {
    switch (handler) {
      case '_handlerMensagem':
        if (
          config?.transicaoAutomatica &&
          (!config.mensagens || config.mensagens.length === 0)
        )
          return 'start';
        if (config?.aguardarEntrada) return 'end';
        return 'message';
      case '_handlerCapturar':
        return 'message';
      case '_handlerBotoes':
        return 'buttons';
      case '_handlerLista':
        return 'listMenu';
      case '_handlerRequisicao':
        return 'action';
      case '_handlerSetVariable':
        return 'action';
      case '_handlerDelay':
        return 'delay';
      default:
        return 'message';
    }
  }

  private handlerConfigToProperties(
    nodeType: string,
    handler: string,
    config: FlowNodeProperties,
    estadoName: string,
  ) {
    config = config || {};

    switch (nodeType) {
      case 'start':
        return { label: estadoName || 'Start' };

      case 'end':
        return {
          label: estadoName || 'End',
          mensagemFim: config.mensagens?.[0] || '',
        };

      case 'buttons': {
        const botoes = (config.botoes || []).map(
          (b: ChoiceItem, i: number) => ({
            id: `btn-${Date.now()}-${i}`,
            label: b.label || b.entrada || '',
            entrada: b.entrada || b.label || '',
          }),
        );
        return {
          label: estadoName || 'Botões',
          titulo: config.titulo || '',
          cabecalho: config.cabecalho || '',
          rodape: config.rodape || '',
          botoes,
        };
      }

      case 'listMenu': {
        const opcoes = (config.opcoes || []).map(
          (o: ChoiceItem, i: number) => ({
            id: `opt-${Date.now()}-${i}`,
            label: o.label || o.entrada || '',
            entrada: o.entrada || o.label || '',
            descricao: o.descricao || '',
          }),
        );
        return {
          label: estadoName || 'Menu de Lista',
          titulo: config.titulo || '',
          botaoTexto: config.botaoTexto || 'Ver opções',
          secaoTitulo: config.secaoTitulo || 'Opções',
          rodape: config.rodape || '',
          opcoes,
        };
      }

      case 'message': {
        if (handler === '_handlerCapturar') {
          const subComponents: FlowSubComponent[] = [];
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
        const subComponents = mensagens.map((msg: string, i: number) => ({
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
        const conditions = items.map((item: ChoiceItem, i: number) => ({
          id: `cond-${Date.now()}-${i}`,
          field: '',
          operator: 'equals',
          value: item.entrada || String(i + 1),
        }));
        return { label: config.titulo || estadoName || 'Decision', conditions };
      }

      case 'action': {
        // setVariable handler → reconstruct setVariable sub-component
        if (handler === '_handlerSetVariable') {
          const assignments = (config.assignments || []).map(
            (a: ChoiceItem, i: number) => ({
              key: a.key,
              name: a.key,
              value: a.value || '',
            }),
          );
          const subComponents = [
            {
              id: `sub-${Date.now()}-sv`,
              type: 'setVariable',
              properties: { assignments },
            },
          ];
          return {
            label: estadoName || 'Action',
            actionType: 'set_variable',
            subComponents,
          };
        }

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
        return { label: estadoName || 'Delay', duration, unit };
      }

      default:
        return { label: estadoName || 'Node' };
    }
  }

  private transicaoToSourcePort(
    transicao: TransicaoOutput,
    sourceNode: FlowNode | undefined,
    todasTransicoes: TransicaoOutput[],
  ): string {
    const isMultiOutput = ['decision', 'buttons', 'listMenu'].includes(
      sourceNode?.type || '',
    );

    if (!sourceNode || !isMultiOutput) return 'output';
    if (transicao.entrada === '*') return 'output-default';

    const transicoesDoEstado = todasTransicoes
      .filter(
        (t: TransicaoOutput) =>
          t.estado_origem === transicao.estado_origem && t.entrada !== '*',
      )
      .sort((a: TransicaoOutput, b: TransicaoOutput) =>
        a.entrada.localeCompare(b.entrada),
      );

    const idx = transicoesDoEstado.findIndex(
      (t: TransicaoOutput) => t.entrada === transicao.entrada,
    );
    return `output-${idx >= 0 ? idx : 0}`;
  }
}
