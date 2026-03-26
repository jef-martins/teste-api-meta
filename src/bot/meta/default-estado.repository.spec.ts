import { DefaultEstadoRepository } from './default-estado.repository';

type EngineEstadoRepoContract = {
  obterConfigEstado: (
    estado: string,
  ) => Promise<
    {
      handler: string;
      descricao?: string | null;
      config?: unknown;
    } | null
  >;
  buscarProximoEstado: (
    estadoAtual: string,
    entrada: string,
    acceptWildcard?: boolean,
  ) => Promise<string | null>;
  obterEstadoUsuario: (chatId: string) => Promise<string | null>;
  salvarEstadoUsuario: (
    chatId: string,
    estado: string,
    nome?: string | null,
  ) => Promise<void>;
  registrarTransicao: (
    chatId: string,
    estadoAnterior: string,
    estadoNovo: string,
    mensagemGatilho?: string | null,
  ) => Promise<void>;
  obterEstadoInicial: () => Promise<string>;
  obterVariaveisFluxoAtivo: () => Promise<Record<string, string>>;
};

describe('DefaultEstadoRepository', () => {
  it('mantem contrato minimo esperado pela StateMachineEngine', () => {
    const repo = new DefaultEstadoRepository();

    const compat: EngineEstadoRepoContract = repo;

    expect(typeof compat.obterEstadoInicial).toBe('function');
    expect(typeof compat.obterVariaveisFluxoAtivo).toBe('function');
  });

  it('retorna variaveis globais vazias no modo padrao', async () => {
    const repo = new DefaultEstadoRepository();

    await expect(repo.obterVariaveisFluxoAtivo()).resolves.toEqual({});
  });
});
