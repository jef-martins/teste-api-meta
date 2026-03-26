import {
  EstadoConfigOutput,
  FlowConverterService,
  FlowJsonPayload,
  TransicaoOutput,
} from './flow-converter.service';

describe('FlowConverterService', () => {
  let service: FlowConverterService;

  beforeEach(() => {
    service = new FlowConverterService();
  });

  it('converte fluxo simples para máquina de estados', () => {
    const flow: FlowJsonPayload = {
      nodes: [
        {
          id: 'n1',
          type: 'message',
          position: { x: 10, y: 20 },
          properties: {
            label: 'Boas-vindas',
            content: 'Olá {usuario.nome}',
          },
        },
      ],
      connections: [],
      variables: [{ key: 'usuario.nome', value: 'Maria' }],
    };

    const result = service.flowToStateMachine(flow);

    expect(result.estados).toHaveLength(1);
    expect(result.estados[0].handler).toBe('_handlerMensagem');
    expect(result.estados[0].config).toMatchObject({
      mensagens: ['Olá {usuario.nome}'],
    });
    expect(result.variaveis).toEqual([{ key: 'usuario.nome', value: 'Maria' }]);
  });

  it('gera sourcePort ordenado para transições com múltiplas saídas', () => {
    const estados: EstadoConfigOutput[] = [
      {
        estado: 'ESCOLHA',
        handler: '_handlerBotoes',
        descricao: 'Escolha',
        ativo: true,
        config: {
          titulo: 'Escolha uma opção',
          botoes: [
            { entrada: '1', label: 'Um' },
            { entrada: '2', label: 'Dois' },
          ],
        },
        node_id: 'n1',
        node_type: 'buttons',
        position: { x: 0, y: 0 },
      },
      {
        estado: 'DEST1',
        handler: '_handlerMensagem',
        descricao: 'Destino 1',
        ativo: true,
        config: { mensagens: ['ok'] },
        node_id: 'n2',
        node_type: 'message',
        position: { x: 200, y: 0 },
      },
      {
        estado: 'DEST2',
        handler: '_handlerMensagem',
        descricao: 'Destino 2',
        ativo: true,
        config: { mensagens: ['ok'] },
        node_id: 'n3',
        node_type: 'message',
        position: { x: 200, y: 120 },
      },
    ];

    const transicoes: TransicaoOutput[] = [
      {
        estado_origem: 'ESCOLHA',
        entrada: '2',
        estado_destino: 'DEST2',
        ativo: true,
      },
      {
        estado_origem: 'ESCOLHA',
        entrada: '1',
        estado_destino: 'DEST1',
        ativo: true,
      },
    ];

    const result = service.stateMachineToFlow(estados, transicoes, []);
    const conexoesDaEscolha = result.connections.filter(
      (c) => c.sourceNodeId === 'n1',
    );

    expect(conexoesDaEscolha).toHaveLength(2);
    expect(conexoesDaEscolha.map((c) => c.sourcePort).sort()).toEqual([
      'output-0',
      'output-1',
    ]);
  });
});
