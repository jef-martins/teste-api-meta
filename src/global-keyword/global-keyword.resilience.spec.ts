import { GlobalKeywordRepository } from './global-keyword.repository';
import { GlobalKeywordService } from './global-keyword.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helper: cria um item de keyword padrão
// ---------------------------------------------------------------------------
const makeKeyword = (overrides: Partial<{
  id: string;
  keyword: string;
  flowId: string | null;
  flowNome: string | null;
  estadoDestino: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}> = {}) => ({
  id: 'kw-1',
  keyword: 'oi',
  flowId: 'flow-1',
  flowNome: 'Fluxo Principal',
  estadoDestino: 'MENU',
  ativo: true,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Fábrica de mocks
// ---------------------------------------------------------------------------
const makePrismaMock = (isConnected: boolean) =>
  ({
    isConnected,
    botFluxo: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    botEstadoConfig: {
      findFirst: jest.fn(),
    },
    botKeywordGlobal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }) as unknown as PrismaService;

// ---------------------------------------------------------------------------
// GlobalKeywordRepository
// ---------------------------------------------------------------------------
describe('GlobalKeywordRepository — resiliência offline', () => {
  it('buscarKeywordAtiva retorna do cache quando banco está offline', async () => {
    const prisma = makePrismaMock(false);
    const repo = new GlobalKeywordRepository(prisma);

    // Preenche o cache manualmente via recarregarCache simulado
    const kw = makeKeyword();
    // Força o cache diretamente usando o método de listar (stub)
    (prisma.botKeywordGlobal.findMany as jest.Mock).mockResolvedValueOnce([kw]);
    // Primeiro recarrega (banco online simulado para carga inicial)
    (prisma as unknown as { isConnected: boolean }).isConnected = true;
    await repo.recarregarCache();

    // Agora simula banco offline
    (prisma as unknown as { isConnected: boolean }).isConnected = false;

    const resultado = await repo.buscarKeywordAtiva('oi', 'flow-1');
    expect(resultado).not.toBeNull();
    expect(resultado?.keyword).toBe('oi');
    expect(resultado?.estadoDestino).toBe('MENU');
  });

  it('buscarKeywordAtiva retorna null se cache vazio e banco offline', async () => {
    const prisma = makePrismaMock(false);
    const repo = new GlobalKeywordRepository(prisma);

    const resultado = await repo.buscarKeywordAtiva('oi', 'flow-1');
    expect(resultado).toBeNull();
  });

  it('listar usa cache quando banco lança exceção em runtime', async () => {
    const prisma = makePrismaMock(true);
    const kw = makeKeyword();

    // Carga inicial (sucesso)
    (prisma.botKeywordGlobal.findMany as jest.Mock).mockResolvedValueOnce([kw]);
    const repo = new GlobalKeywordRepository(prisma);
    await repo.recarregarCache();

    // Simula queda do banco em runtime
    (prisma.botKeywordGlobal.findMany as jest.Mock).mockRejectedValueOnce(
      new Error('Connection lost'),
    );

    const resultado = await repo.listar();
    expect(resultado.length).toBe(1);
    expect(resultado[0].keyword).toBe('oi');
  });

  it('recarregarCache não zera cache em caso de erro', async () => {
    const prisma = makePrismaMock(true);
    const kw = makeKeyword();

    // Carga inicial
    (prisma.botKeywordGlobal.findMany as jest.Mock).mockResolvedValueOnce([kw]);
    const repo = new GlobalKeywordRepository(prisma);
    await repo.recarregarCache();
    expect(repo.getCacheSnapshot().length).toBe(1);

    // Tenta recarregar com erro
    (prisma.botKeywordGlobal.findMany as jest.Mock).mockRejectedValueOnce(
      new Error('DB down'),
    );
    await repo.recarregarCache();

    // Cache anterior deve ser mantido
    expect(repo.getCacheSnapshot().length).toBe(1);
    expect(repo.getCacheSnapshot()[0].keyword).toBe('oi');
  });

  it('criar atualiza cache local após inserção', async () => {
    const prisma = makePrismaMock(true);
    const kw = makeKeyword();
    (prisma.botKeywordGlobal.create as jest.Mock).mockResolvedValueOnce(kw);

    const repo = new GlobalKeywordRepository(prisma);
    await repo.criar({
      keyword: 'oi',
      flowId: 'flow-1',
      estadoDestino: 'MENU',
      ativo: true,
    });

    expect(repo.getCacheSnapshot().length).toBe(1);
    expect(repo.getCacheSnapshot()[0].keyword).toBe('oi');
  });
});

// ---------------------------------------------------------------------------
// GlobalKeywordService.buscarKeywordAtiva — nunca deve lançar exceção
// ---------------------------------------------------------------------------
describe('GlobalKeywordService.buscarKeywordAtiva — nunca lança exceção', () => {
  let envAnterior: string | undefined;

  beforeEach(() => {
    // Garante modo banco (não memória) durante os testes
    envAnterior = process.env.BOT_STATE_MACHINE_PADRAO;
    delete process.env.BOT_STATE_MACHINE_PADRAO;
  });

  afterEach(() => {
    // Restaura env original
    if (envAnterior !== undefined) {
      process.env.BOT_STATE_MACHINE_PADRAO = envAnterior;
    } else {
      delete process.env.BOT_STATE_MACHINE_PADRAO;
    }
  });

  const makeRepoMock = () =>
    ({
      recarregarCache: jest.fn().mockResolvedValue(undefined),
      buscarKeywordAtiva: jest.fn().mockResolvedValue(null),
      listar: jest.fn().mockResolvedValue([]),
      buscarPorId: jest.fn().mockResolvedValue(null),
      buscarPorKeyword: jest.fn().mockResolvedValue(null),
      criar: jest.fn(),
      atualizar: jest.fn(),
      atualizarAtivo: jest.fn(),
      excluir: jest.fn(),
    }) as unknown as GlobalKeywordRepository;

  it('retorna null em vez de lançar quando repositório lança exceção', async () => {
    const prisma = makePrismaMock(false);
    const repo = makeRepoMock();
    (repo.buscarKeywordAtiva as jest.Mock).mockRejectedValueOnce(
      new Error('Unexpected DB error'),
    );

    const service = new GlobalKeywordService(prisma, repo);

    await expect(service.buscarKeywordAtiva('oi', 'flow-1')).resolves.toBeNull();
  });

  it('retorna keyword do cache do repositório quando banco caiu', async () => {
    const prisma = makePrismaMock(false);
    const repo = makeRepoMock();
    const kw = makeKeyword();
    // mockResolvedValue (sem Once) para garantir retorno em qualquer chamada
    (repo.buscarKeywordAtiva as jest.Mock).mockResolvedValue(kw);

    const service = new GlobalKeywordService(prisma, repo);
    const result = await service.buscarKeywordAtiva('oi', 'flow-1');

    expect(result).not.toBeNull();
    expect(result?.estadoDestino).toBe('MENU');
  });

  it('retorna null para keyword vazia', async () => {
    const prisma = makePrismaMock(true);
    const repo = makeRepoMock();
    const service = new GlobalKeywordService(prisma, repo);

    await expect(service.buscarKeywordAtiva('', 'flow-1')).resolves.toBeNull();
    await expect(service.buscarKeywordAtiva('  ', 'flow-1')).resolves.toBeNull();
  });
});

describe('GlobalKeywordService.criar — vínculo obrigatório com fluxo', () => {
  let envAnterior: string | undefined;

  beforeEach(() => {
    envAnterior = process.env.BOT_STATE_MACHINE_PADRAO;
    delete process.env.BOT_STATE_MACHINE_PADRAO;
  });

  afterEach(() => {
    if (envAnterior !== undefined) {
      process.env.BOT_STATE_MACHINE_PADRAO = envAnterior;
    } else {
      delete process.env.BOT_STATE_MACHINE_PADRAO;
    }
  });

  const makeRepoMock = () =>
    ({
      recarregarCache: jest.fn().mockResolvedValue(undefined),
      buscarKeywordAtiva: jest.fn().mockResolvedValue(null),
      listar: jest.fn().mockResolvedValue([]),
      buscarPorId: jest.fn().mockResolvedValue(null),
      buscarPorKeyword: jest.fn().mockResolvedValue(null),
      criar: jest.fn(),
      atualizar: jest.fn(),
      atualizarAtivo: jest.fn(),
      excluir: jest.fn(),
    }) as unknown as GlobalKeywordRepository;

  it('rejeita criação sem flow_nome/flow_id', async () => {
    const prisma = makePrismaMock(true);
    const repo = makeRepoMock();
    const service = new GlobalKeywordService(prisma, repo);

    await expect(
      service.criar({
        keyword: 'oi',
        estado_destino: 'MENU',
      }),
    ).rejects.toThrow('Fluxo é obrigatório');
  });

  it('resolve flow_nome para flow_id e persiste no repositório', async () => {
    const prisma = makePrismaMock(true);
    const repo = makeRepoMock();
    (prisma.botFluxo.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'flow-1', nome: 'Fluxo Principal', ativo: true },
    ]);
    (prisma.botEstadoConfig.findFirst as jest.Mock).mockResolvedValueOnce({
      estado: 'MENU',
    });
    (repo.criar as jest.Mock).mockResolvedValueOnce(
      makeKeyword({
        id: 'kw-2',
        keyword: 'oi',
        flowId: 'flow-1',
        flowNome: 'Fluxo Principal',
        estadoDestino: 'MENU',
      }),
    );

    const service = new GlobalKeywordService(prisma, repo);
    const resultado = await service.criar({
      keyword: 'oi',
      flow_nome: 'Fluxo Principal',
      estado_destino: 'MENU',
    });

    expect(repo.criar).toHaveBeenCalledWith({
      keyword: 'oi',
      flowId: 'flow-1',
      estadoDestino: 'MENU',
      ativo: true,
    });
    expect(resultado.flow_id).toBe('flow-1');
    expect(resultado.flow_nome).toBe('Fluxo Principal');
  });
});
