import { Prisma } from '@prisma/client';

export type DelegateHandler = (
  message: any,
  chatId: string,
  corpo: string,
  engine: any,
) => Promise<void> | void;

export interface EstadoConfig {
  handler: string;
  descricao?: string | null;
  flowId?: string | null;
  config?: any;
}

export interface ItemInterativoNormalizado {
  entrada: string;
  label: string;
  descricao: string;
}

export interface ItemInterativoObjeto {
  entrada?: any;
  label?: any;
  descricao?: any;
  description?: any;
  id?: any;
  rowId?: any;
  value?: any;
  payload?: any;
  title?: any;
  text?: any;
  [key: string]: any;
}

export interface HandlerMessage {
  from: string;
  [key: string]: any;
}

export interface Assignment {
  key?: string;
  value?: any;
  [key: string]: any;
}

export interface CampoCaptura {
  nome: string;
  mensagemPedir: string;
  valoresAceitos?: string[];
  mensagemInvalida?: string;
  [key: string]: any;
}

export interface HandlerConfig {
  mensagens?: string[];
  assignments?: Assignment[];
  transicaoAutomatica?: boolean;
  transicao_automatica?: boolean;
  campos?: CampoCaptura[];
  mensagemPedir?: string;
  mensagemInvalida?: string;
  campoSalvar?: string;
  campoEnviar?: string;
  mensagemConfirmacao?: string;
  opcoes?: ItemInterativoObjeto[] | ItemInterativoNormalizado[];
  botoes?: ItemInterativoObjeto[] | ItemInterativoNormalizado[];
  titulo?: string;
  botaoTexto?: string;
  secaoTitulo?: string;
  rodape?: string;
  cabecalho?: string;
  body?: Record<string, any>;
  camposEnviar?: string[];
  palavraSair?: string;
  apiId?: string;
  routeId?: string;
  url?: string;
  metodo?: string;
  headers?: Record<string, string>;
  campoResposta?: string;
  variavelResposta?: string;
  mensagemErro?: string;
  mensagemNaoEncontrado?: string;
  mensagemSucesso?: string;
  separador?: string;
  limparDados?: boolean;
  duracao?: number;
  unidade?: string;
  mensagem?: string;
  [key: string]: any;
}

export interface WppClient {
  sendText: (destino: string, texto: string, chatId?: string) => Promise<any>;
  sendListMessage?: (destino: string, payload: any, chatId?: string) => Promise<any>;
  sendButtons?: (
    destino: string,
    titulo: string,
    botoes: Array<{ id: string; text: string }>,
    rodape: string,
  ) => Promise<any>;
  sendButtonsMessage?: (destino: string, payload: any, chatId?: string) => Promise<any>;
}

export type DynamicHandler = (
  message: HandlerMessage,
  chatId: string,
  corpo: string,
  engine: any,
) => Promise<any> | any;

export interface EstadoConfigCacheItem {
  handler: string;
  descricao: string | null;
  flowId: string | null;
  config: Prisma.JsonValue;
}

export interface TransicaoCacheItem {
  entrada: string;
  estadoDestino: string;
}

export interface SessaoCache {
  estado?: string;
  nome?: string | null;
  flowId?: string | null;
  ultimaAtividadeEm?: string;
  meta?: any;
}

export interface FluxoMemoriaResumo {
  flowId: string | null;
  estados: number;
  transicoes: number;
}

export type SyncTaskType = 'state_update' | 'transition';

export interface SyncTask {
  type: SyncTaskType;
  data: any;
}

export interface ConfigExpiracaoOciosidade {
  tempoExpiracaoMs: number | null;
  mensagemExpiracao: string | null;
}

