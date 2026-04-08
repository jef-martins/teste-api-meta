export type PrimitiveId = string | number;

export interface OpcoesValidacaoObjeto {
  validation?: any;
  mensagem_resposta_invalida?: string;
  mensagem_expiracao?: string;
}

export interface InputItem {
  id?: PrimitiveId;
  ordem?: number;
  tipo?: string;
  texto?: string;
  opcoes_validacao?: string | number | null | OpcoesValidacaoObjeto;
  opcoesValidacao?: string | number | null | OpcoesValidacaoObjeto;
  mensagem?: string;
}

export interface ItemResposta {
  id: PrimitiveId;
  ordem: number;
  tipo: string;
  mensagem: string;
  opcoesValidacao: string[];
  mensagemInvalida: string | null;
  mensagemExpiracao: string | null;
  exigeResposta: boolean;
  resposta: string | null;
  perguntaMessageId: string | null;
  perguntaProviderResponse: any | null;
  respostaMessageId: string | null;
  respondidoEm: string | null;
}

export type SessaoStatus = 'active' | 'completed';

export interface StartInput {
  pesquisa_id?: string;
  conversa_id?: string;
  from?: string;
  to?: string;
  itens?: InputItem[];
  mensagens?: InputItem[];
  callbackUrl?: string;
  callbackHeaders?: Record<string, string>;
  headers?: Record<string, string>;
  Headers?: Record<string, string>;
  zenviaToken?: string;
  zenviaBaseUrl?: string;
  zenviaWebhookSecret?: string;
  zenviaHeaders?: Record<string, string>;
  ZENVIA_TOKEN?: string;
  ZENVIA_WHATSAPP_FROM?: string;
  ZENVIA_BASE_URL?: string;
  ZENVIA_WEBHOOK_SECRET?: string;
  tempo_expiracao_minutos?: number | null;
  tempoExpiracaoMinutos?: number | null;
  executionId?: string;
  execution_id?: string;
}

export type SourceType = 'interactive' | 'button' | 'text' | 'unknown';

export interface NormalizedInbound {
  from: string;
  to: string;
  text: string;
  pesquisa_id: string | null;
  sourceType: SourceType;
}

export interface FetchJsonResult {
  messageId: string | null;
  payload: any;
}

export interface ZenviaButtonItem {
  id: string;
  title: string;
}

export interface ButtonsClientPayload {
  body?: any;
  titulo?: any;
  buttons?: any;
}

export interface ZenviaListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ZenviaListSection {
  title: string;
  rows: ZenviaListRow[];
}

export interface ZenviaListContent {
  type: 'list';
  body: string;
  button: string;
  sections: ZenviaListSection[];
  header?: string;
  footer?: string;
}

export interface StartQueryInput {
  to?: string;
  from?: string;
  token?: string;
  baseUrl?: string;
  webhookSecret?: string;
  pesquisa_id?: string;
}

export interface ZenviaSessionContext {
  from: string;
  to: string;
  token: string;
  baseUrl: string;
  headers: Record<string, string>;
}

