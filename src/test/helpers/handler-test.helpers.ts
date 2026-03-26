type EngineMockOptions = {
  chatId: string;
  estado: string;
  dados?: Record<string, unknown>;
  interpolar?: jest.Mock;
  transitarPorEntrada?: jest.Mock;
  extrairValorPath?: jest.Mock;
  limparDados?: jest.Mock;
  avancarEstado?: jest.Mock;
  salvarDado?: jest.Mock;
};

export const createEstadoRepoMock = () => ({
  obterConfigEstado: jest.fn(),
  buscarProximoEstado: jest.fn(),
});

export const createFetchMock = (defaultResponse?: unknown): jest.Mock => {
  const fetchMock = jest.fn();
  if (defaultResponse !== undefined) {
    fetchMock.mockResolvedValue(defaultResponse);
  }

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

export const createEngineMock = ({
  chatId,
  estado,
  dados = {},
  interpolar,
  transitarPorEntrada,
  extrairValorPath,
  limparDados,
  avancarEstado,
  salvarDado,
}: EngineMockOptions) => ({
  estadosUsuarios: new Map([[chatId, estado]]),
  obterDados: jest.fn().mockReturnValue(dados),
  interpolar:
    interpolar ??
    jest
      .fn()
      .mockImplementation((texto: string, vars: Record<string, unknown> = {}) =>
        texto.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
          const tokens = String(expr)
            .trim()
            .replace(/\[(\d+)\]/g, '.$1')
            .split('.');

          const valor = tokens.reduce<unknown>((acc, key) => {
            if (!acc || typeof acc !== 'object') {
              return undefined;
            }
            return (acc as Record<string, unknown>)[key];
          }, vars);

          if (
            typeof valor === 'string' ||
            typeof valor === 'number' ||
            typeof valor === 'boolean' ||
            typeof valor === 'bigint'
          ) {
            return String(valor);
          }

          return `{{${expr}}}`;
        }),
      ),
  transitarPorEntrada: transitarPorEntrada ?? jest.fn().mockResolvedValue(null),
  extrairValorPath:
    extrairValorPath ??
    jest.fn().mockImplementation((obj: unknown, path: string) => {
      if (!path) return obj;
      return path
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .reduce<unknown>((acc, key) => {
          if (!acc || typeof acc !== 'object') {
            return undefined;
          }
          return (acc as Record<string, unknown>)[key];
        }, obj);
    }),
  limparDados: limparDados ?? jest.fn(),
  avancarEstado: avancarEstado ?? jest.fn(),
  salvarDado: salvarDado ?? jest.fn(),
});
