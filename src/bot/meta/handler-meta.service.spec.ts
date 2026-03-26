import { Test, TestingModule } from '@nestjs/testing';
import { HandlerMetaService } from './handler-meta.service';
import { EstadoRepository } from '../estado.repository';
import { StateMachineEngine } from '../state-machine.engine';
import {
  createEngineMock,
  createEstadoRepoMock,
  createFetchMock,
} from '../../test/helpers/handler-test.helpers';

describe('HandlerMetaService', () => {
  let service: HandlerMetaService;
  let fetchMock: jest.Mock;

  let estadoRepoMock: ReturnType<typeof createEstadoRepoMock>;

  beforeEach(async () => {
    estadoRepoMock = createEstadoRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandlerMetaService,
        {
          provide: EstadoRepository,
          useValue: estadoRepoMock,
        },
      ],
    }).compile();

    service = module.get(HandlerMetaService);
    service.phone_id = '123456789';
    service.access_token = 'token-fake';

    fetchMock = createFetchMock({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
    });
    jest.clearAllMocks();
  });

  it('normaliza itens interativos a partir de objeto com buttons', () => {
    const bruto = {
      buttons: [
        { payload: 'sim', text: 'Sim' },
        { payload: 'nao', text: 'Nao', description: 'Detalhe fake' },
      ],
    };

    const resultado = service['normalizarItensInterativos'](
      bruto,
      'chat-meta-1',
      'botoes',
    );

    expect(resultado).toEqual([
      { entrada: 'sim', label: 'Sim', descricao: '' },
      { entrada: 'nao', label: 'Nao', descricao: 'Detalhe fake' },
    ]);
  });

  it('envia mensagens interpoladas para a Meta API com payload fake', async () => {
    estadoRepoMock.obterConfigEstado.mockResolvedValue({
      config: JSON.stringify({
        mensagens: ['Ola {{nome}}', 'Seu protocolo e {{protocolo}}'],
      }),
    });

    const engineMock = createEngineMock({
      chatId: 'chat-meta-2',
      estado: 'ESTADO_META_FAKE',
      dados: {
        nome: 'Maria',
        protocolo: '123456',
      },
    });

    await service._handlerMensagem(
      { from: '5511999999999@meta' },
      'chat-meta-2',
      '',
      engineMock as unknown as StateMachineEngine,
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v18.0/123456789/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-fake',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '5511999999999',
          type: 'text',
          text: { body: 'Ola Maria' },
        }),
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://graph.facebook.com/v18.0/123456789/messages',
      expect.objectContaining({
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '5511999999999',
          type: 'text',
          text: { body: 'Seu protocolo e 123456' },
        }),
      }),
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
      chatId: 'chat-meta-3',
      estado: 'ESTADO_META_AUTO',
    });
    const messageFake = { from: '5511888888888@meta' };

    await service._handlerMensagem(
      messageFake,
      'chat-meta-3',
      '',
      engineMock as unknown as StateMachineEngine,
    );

    expect(engineMock.transitarPorEntrada).toHaveBeenCalledWith(
      'chat-meta-3',
      'ESTADO_META_AUTO',
      '*',
      messageFake,
      true,
      null,
      service,
    );
  });
});
