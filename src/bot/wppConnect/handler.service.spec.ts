import { Test, TestingModule } from '@nestjs/testing';
import { HandlerService } from './handler.service';
import { EstadoRepository } from '../estado.repository';
import {
  createEngineMock,
  createEstadoRepoMock,
  createFetchMock,
} from '../../test/helpers/handler-test.helpers';

describe('HandlerService', () => {
  let service: HandlerService;
  let fetchMock: jest.Mock;

  let estadoRepoMock: ReturnType<typeof createEstadoRepoMock>;

  beforeEach(async () => {
    estadoRepoMock = createEstadoRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandlerService,
        {
          provide: EstadoRepository,
          useValue: estadoRepoMock,
        },
      ],
    }).compile();

    service = module.get(HandlerService);
    service.client = {
      sendText: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

    fetchMock = createFetchMock();
    jest.clearAllMocks();
  });

  it('normaliza itens interativos a partir de JSON string', () => {
    const bruto = JSON.stringify([
      { id: '1', title: 'Opcao 1' },
      { id: '2', title: 'Opcao 2', description: 'Detalhe fake' },
    ]);

    const resultado = (service as any).normalizarItensInterativos(bruto, 'opcoes');

    expect(resultado).toEqual([
      { entrada: '1', label: 'Opcao 1', descricao: '' },
      { entrada: '2', label: 'Opcao 2', descricao: 'Detalhe fake' },
    ]);
  });

  it('envia mensagens interpoladas usando config fake e engine mockado', async () => {
    estadoRepoMock.obterConfigEstado.mockResolvedValue({
      config: JSON.stringify({
        mensagens: ['Ola {{nome}}', 'Seu protocolo e {{protocolo}}'],
      }),
    });

    const engineMock = createEngineMock({
      chatId: 'chat-1',
      estado: 'ESTADO_FAKE',
      dados: {
        nome: 'Maria',
        protocolo: '123456',
      },
    });

    const messageFake = { from: '5511999999999@c.us' };

    await service._handlerMensagem(messageFake, 'chat-1', '', engineMock as any);

    expect(estadoRepoMock.obterConfigEstado).toHaveBeenCalledWith('ESTADO_FAKE');
    expect(engineMock.obterDados).toHaveBeenCalledWith('chat-1');
    expect(service.client.sendText).toHaveBeenNthCalledWith(
      1,
      '5511999999999@c.us',
      'Ola Maria',
    );
    expect(service.client.sendText).toHaveBeenNthCalledWith(
      2,
      '5511999999999@c.us',
      'Seu protocolo e 123456',
    );
  });

  it('executa transicao automatica quando configurada', async () => {
    estadoRepoMock.obterConfigEstado.mockResolvedValue({
      config: {
        mensagens: ['Mensagem fake'],
        transicaoAutomatica: true,
      },
    });

    const engineMock = createEngineMock({
      chatId: 'chat-2',
      estado: 'ESTADO_AUTO',
    });
    const messageFake = { from: '5511888888888@c.us' };

    await service._handlerMensagem(messageFake, 'chat-2', '', engineMock as any);

    expect(engineMock.transitarPorEntrada).toHaveBeenCalledWith(
      'chat-2',
      'ESTADO_AUTO',
      '*',
      messageFake,
      true,
      null,
      service,
    );
  });

  it('processa requisicao com sucesso usando resposta fake da API', async () => {
    estadoRepoMock.obterConfigEstado.mockResolvedValue({
      config: {
        metodo: 'GET',
        url: 'https://api.fake/clientes/{{valor}}',
        campoResposta: 'data',
        mensagemSucesso: 'Cliente: {{nome}}',
      },
    });

    fetchMock.mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: { nome: 'Maria' },
      }),
    });

    const engineMock = createEngineMock({
      chatId: 'chat-req-1',
      estado: 'ESTADO_REQ_OK',
    });

    await service._handlerRequisicao(
      { from: '5511999999999@c.us' },
      'chat-req-1',
      'ABC123',
      engineMock as any,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.fake/clientes/ABC123?valor=ABC123',
      { headers: { 'Content-Type': 'application/json' } },
    );
    expect(service.client.sendText).toHaveBeenCalledWith(
      '5511999999999@c.us',
      'Cliente: Maria',
    );
  });

  it('envia mensagem de nao encontrado quando a API retorna lista vazia', async () => {
    estadoRepoMock.obterConfigEstado.mockResolvedValue({
      config: {
        metodo: 'GET',
        url: 'https://api.fake/clientes',
        campoResposta: 'data',
        mensagemNaoEncontrado: 'Nenhum cliente encontrado.',
      },
    });

    fetchMock.mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [],
      }),
    });

    const engineMock = createEngineMock({
      chatId: 'chat-req-2',
      estado: 'ESTADO_REQ_EMPTY',
    });

    await service._handlerRequisicao(
      { from: '5511999999999@c.us' },
      'chat-req-2',
      'ABC123',
      engineMock as any,
    );

    expect(service.client.sendText).toHaveBeenCalledWith(
      '5511999999999@c.us',
      'Nenhum cliente encontrado.',
    );
  });

  it('envia mensagem de erro quando a API falha', async () => {
    estadoRepoMock.obterConfigEstado.mockResolvedValue({
      config: {
        metodo: 'GET',
        url: 'https://api.fake/clientes',
        mensagemErro: 'Erro ao consultar API fake.',
      },
    });

    fetchMock.mockRejectedValue(new Error('Falha de rede fake'));

    const engineMock = createEngineMock({
      chatId: 'chat-req-3',
      estado: 'ESTADO_REQ_ERROR',
    });

    await service._handlerRequisicao(
      { from: '5511999999999@c.us' },
      'chat-req-3',
      'ABC123',
      engineMock as any,
    );

    expect(service.client.sendText).toHaveBeenCalledWith(
      '5511999999999@c.us',
      'Erro ao consultar API fake.',
    );
  });
});
