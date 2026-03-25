type EngineMockOptions = {
  chatId: string;
  estado: string;
  dados?: Record<string, any>;
  interpolar?: jest.Mock;
  transitarPorEntrada?: jest.Mock;
  extrairValorPath?: jest.Mock;
  limparDados?: jest.Mock;
  avancarEstado?: jest.Mock;
};

export const createEstadoRepoMock = () => ({
  obterConfigEstado: jest.fn(),
  buscarProximoEstado: jest.fn(),
});

export const createFetchMock = (defaultResponse?: any): jest.Mock => {
  const fetchMock = jest.fn();
  if (defaultResponse !== undefined) {
    fetchMock.mockResolvedValue(defaultResponse);
  }
  (global as any).fetch = fetchMock;
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
}: EngineMockOptions) => ({
  estadosUsuarios: new Map([[chatId, estado]]),
  obterDados: jest.fn().mockReturnValue(dados),
  interpolar:
    interpolar ??
    jest.fn().mockImplementation(
      (texto: string, vars: Record<string, any> = {}) =>
        texto.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
          const tokens = String(expr)
            .trim()
            .replace(/\[(\d+)\]/g, '.$1')
            .split('.');
          const valor = tokens.reduce(
            (acc: any, key: string) => acc?.[key],
            vars,
          );
          return valor !== undefined && valor !== null
            ? String(valor)
            : `{{${expr}}}`;
        }),
    ),
  transitarPorEntrada: transitarPorEntrada ?? jest.fn().mockResolvedValue(null),
  extrairValorPath:
    extrairValorPath ??
    jest.fn().mockImplementation((obj: any, path: string) => {
      if (!path) return obj;
      return path
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .reduce((acc: any, key: string) => acc?.[key], obj);
    }),
  limparDados: limparDados ?? jest.fn(),
  avancarEstado: avancarEstado ?? jest.fn(),
});
