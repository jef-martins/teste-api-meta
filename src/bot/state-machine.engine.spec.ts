import { StateMachineEngine } from './state-machine.engine';
import { EstadoRepository } from './estado.repository';
import { GlobalKeywordService } from '../global-keyword/global-keyword.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Testes originais
// ---------------------------------------------------------------------------
describe('StateMachineEngine', () => {
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

// ---------------------------------------------------------------------------
// Testes de resiliência offline-first
// ---------------------------------------------------------------------------
describe('StateMachineEngine — resiliência offline-first', () => {
  it('continua o fluxo via cache quando atalho de navegação retorna null (DB down)', async () => {
    const { estadoRepo, globalKeyword } = createMocks();

    estadoRepo.obterEstadoInicial.mockResolvedValue('INICIAL');
    estadoRepo.obterEstadoUsuario.mockResolvedValue(null);
    estadoRepo.obterVariaveisFluxoAtivo.mockResolvedValue({});
    estadoRepo.salvarEstadoUsuario.mockResolvedValue(undefined);
    estadoRepo.registrarTransicao.mockResolvedValue(undefined);

    // Simula DB down: buscarKeywordAtiva retorna null (sem exceção)
    globalKeyword.buscarKeywordAtiva.mockResolvedValue(null);

    estadoRepo.obterConfigEstado.mockResolvedValue({
      handler: '_handlerMenu',
      descricao: null,
      config: {},
    });
    estadoRepo.buscarProximoEstado.mockResolvedValue('MENU');

    const engine = new StateMachineEngine(
      estadoRepo as unknown as EstadoRepository,
      globalKeyword as unknown as GlobalKeywordService,
    );
    engine.estadosUsuarios.set('chat-2', 'INICIAL');

    const actionDelegate = {
      _handlerMenu: jest.fn().mockResolvedValue(undefined),
    };

    await engine.process({}, 'chat-2', 'menu', 'João', actionDelegate);

    // O fluxo deve continuar normalmente mesmo sem DB
    expect(estadoRepo.obterConfigEstado).toHaveBeenCalledWith('INICIAL');
    expect(globalKeyword.buscarKeywordAtiva).toHaveBeenCalledWith('menu', null);
  });

  it('não lança exceção quando keyword service retorna null inesperadamente', async () => {
    const { estadoRepo, globalKeyword } = createMocks();

    estadoRepo.obterEstadoInicial.mockResolvedValue('INICIAL');
    estadoRepo.obterEstadoUsuario.mockResolvedValue(null);
    estadoRepo.obterVariaveisFluxoAtivo.mockResolvedValue({});
    estadoRepo.salvarEstadoUsuario.mockResolvedValue(undefined);
    estadoRepo.registrarTransicao.mockResolvedValue(undefined);
    estadoRepo.buscarProximoEstado.mockResolvedValue(null);

    // GlobalKeywordService nunca lança — retorna null mesmo em falha interna
    globalKeyword.buscarKeywordAtiva.mockResolvedValue(null);

    estadoRepo.obterConfigEstado.mockResolvedValue({
      handler: '_handlerInicial',
      descricao: null,
      config: {},
    });

    const engine = new StateMachineEngine(
      estadoRepo as unknown as EstadoRepository,
      globalKeyword as unknown as GlobalKeywordService,
    );
    engine.estadosUsuarios.set('chat-3', 'INICIAL');

    const actionDelegate = {
      _handlerInicial: jest.fn().mockResolvedValue(undefined),
    };

    // Não deve lançar exceção
    await expect(
      engine.process({}, 'chat-3', 'qualquer', 'Ana', actionDelegate),
    ).resolves.not.toThrow();
  });

  it('utiliza estado inicial em cache quando DB está indisponível desde o start', async () => {
    const { estadoRepo, globalKeyword } = createMocks();

    // Simula banco nunca conectado: retorna estado padrão 'NOVO'
    estadoRepo.obterEstadoInicial.mockResolvedValue('NOVO');
    estadoRepo.obterEstadoUsuario.mockResolvedValue(null);
    estadoRepo.obterVariaveisFluxoAtivo.mockResolvedValue({});
    estadoRepo.salvarEstadoUsuario.mockResolvedValue(undefined);
    estadoRepo.registrarTransicao.mockResolvedValue(undefined);
    globalKeyword.buscarKeywordAtiva.mockResolvedValue(null);

    // Config retorna null para 'NOVO' (sem config no banco/cache)
    estadoRepo.obterConfigEstado.mockResolvedValue(null);

    const engine = new StateMachineEngine(
      estadoRepo as unknown as EstadoRepository,
      globalKeyword as unknown as GlobalKeywordService,
    );

    const actionDelegate = {};

    // Não deve lançar — apenas loga warn e tenta reiniciar
    await expect(
      engine.process({}, 'chat-4', 'oi', 'Teste', actionDelegate),
    ).resolves.not.toThrow();

    expect(estadoRepo.obterEstadoInicial).toHaveBeenCalled();
  });

  it('continua processando mensagem quando salvarEstadoUsuario falha', async () => {
    const { estadoRepo, globalKeyword } = createMocks();

    estadoRepo.obterEstadoInicial.mockResolvedValue('INICIAL');
    estadoRepo.obterEstadoUsuario.mockResolvedValue(null);
    estadoRepo.obterVariaveisFluxoAtivo.mockResolvedValue({});
    // salvar lança exceção — não deve derrubar o fluxo
    estadoRepo.salvarEstadoUsuario.mockRejectedValue(
      new Error('Redis down'),
    );
    estadoRepo.registrarTransicao.mockRejectedValue(
      new Error('DB down'),
    );
    globalKeyword.buscarKeywordAtiva.mockResolvedValue(null);

    estadoRepo.obterConfigEstado.mockResolvedValue({
      handler: '_handlerInicial',
      descricao: null,
      config: {},
    });
    estadoRepo.buscarProximoEstado.mockResolvedValue('PROXIMO');

    const engine = new StateMachineEngine(
      estadoRepo as unknown as EstadoRepository,
      globalKeyword as unknown as GlobalKeywordService,
    );
    engine.estadosUsuarios.set('chat-5', 'INICIAL');

    const actionDelegate = {
      _handlerInicial: jest.fn().mockResolvedValue(undefined),
    };

    // Promise.allSettled garante que falha em salvar não derruba o processo
    await expect(
      engine.process({}, 'chat-5', 'entrada', 'User', actionDelegate),
    ).resolves.not.toThrow();
  });
});
