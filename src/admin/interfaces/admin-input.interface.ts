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

export interface FluxoBancoPainel {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  organizacaoId: string | null;
  organizacaoNome: string | null;
  subOrganizacaoId: string | null;
  subOrganizacaoNome: string | null;
}

export interface FluxoMemoriaPainel {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  origem: 'cache' | 'padrao' | 'sessao_zenvia';
  estados: number;
  transicoes: number;
  organizacaoNome: string | null;
  subOrganizacaoNome: string | null;
  navegavel: boolean;
}
