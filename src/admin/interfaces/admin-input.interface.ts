export interface EstadoInput {
  estado: string;
  handler: string;
  descricao?: string;
  config?: unknown;
}

export interface EstadoUpdateInput {
  handler: string;
  descricao?: string;
  config?: unknown;
  ativo?: boolean;
}

export interface TransicaoInput {
  estado_origem: string;
  entrada: string;
  estado_destino: string;
}

export interface TransicaoUpdateInput extends TransicaoInput {
  ativo?: boolean;
}

export interface TesteRequisicaoInput {
  config: unknown;
  valor?: string;
  variaveis?: Record<string, string>;
}
