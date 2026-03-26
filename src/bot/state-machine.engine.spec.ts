import { StateMachineEngine } from './state-machine.engine';
import { EstadoRepository } from './estado.repository';
import { GlobalKeywordService } from '../global-keyword/global-keyword.service';

describe('StateMachineEngine', () => {
  const createMocks = () => {
    const estadoRepo = {
      obterEstadoInicial: jest.fn(),
      obterEstadoUsuario: jest.fn(),
      obterVariaveisFluxoAtivo: jest.fn(),
      obterConfigEstado: jest.fn(),
      buscarProximoEstado: jest.fn(),
      salvarEstadoUsuario: jest.fn(),
      registrarTransicao: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<
        EstadoRepository,
        | 'obterEstadoInicial'
        | 'obterEstadoUsuario'
        | 'obterVariaveisFluxoAtivo'
        | 'obterConfigEstado'
        | 'buscarProximoEstado'
        | 'salvarEstadoUsuario'
        | 'registrarTransicao'
      >
    >;

    const globalKeyword = {
      buscarKeywordAtiva: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<GlobalKeywordService, 'buscarKeywordAtiva'>
    >;

    return { estadoRepo, globalKeyword };
  };

  it('reinicia para estado inicial quando estado aguarda entrada e não encontra transição', async () => {
    const { estadoRepo, globalKeyword } = createMocks();

    estadoRepo.obterEstadoInicial.mockResolvedValue('INICIAL');
    estadoRepo.obterEstadoUsuario.mockResolvedValue(null);
    estadoRepo.obterVariaveisFluxoAtivo.mockResolvedValue({});
    estadoRepo.buscarProximoEstado.mockResolvedValue(null);
    estadoRepo.salvarEstadoUsuario.mockResolvedValue(undefined);
    estadoRepo.registrarTransicao.mockResolvedValue(undefined);
    globalKeyword.buscarKeywordAtiva.mockResolvedValue(null);

    estadoRepo.obterConfigEstado.mockImplementation((estado: string) => {
      if (estado === 'AGUARDANDO') {
        return Promise.resolve({
          handler: '_handlerAguardando',
          descricao: null,
          config: { aguardarEntrada: true },
        });
      }

      if (estado === 'INICIAL') {
        return Promise.resolve({
          handler: '_handlerInicial',
          descricao: null,
          config: {},
        });
      }

      return Promise.resolve(null);
    });

    const engine = new StateMachineEngine(
      estadoRepo as unknown as EstadoRepository,
      globalKeyword as unknown as GlobalKeywordService,
    );

    engine.estadosUsuarios.set('chat-1', 'AGUARDANDO');

    const message = { from: '5511999999999@c.us' };
    const actionDelegate = {
      _handlerInicial: jest.fn().mockResolvedValue(undefined),
    };

    await engine.process(
      message,
      'chat-1',
      'entrada invalida',
      'Maria',
      actionDelegate,
    );

    expect(estadoRepo.buscarProximoEstado).toHaveBeenCalledWith(
      'AGUARDANDO',
      'entrada invalida',
      false,
    );

    expect(estadoRepo.salvarEstadoUsuario).toHaveBeenCalledWith(
      'chat-1',
      'INICIAL',
      'Maria',
    );
    expect(estadoRepo.registrarTransicao).toHaveBeenCalledWith(
      'chat-1',
      'AGUARDANDO',
      'INICIAL',
      'entrada invalida',
    );

    expect(actionDelegate._handlerInicial).toHaveBeenCalledWith(
      message,
      'chat-1',
      '',
      engine,
    );
    expect(engine.estadosUsuarios.get('chat-1')).toBe('INICIAL');
  });
});
