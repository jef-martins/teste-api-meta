import { Injectable, Logger } from '@nestjs/common';
import { EstadoRepository } from '../estado.repository';
import { StateMachineEngine } from '../state-machine.engine';
import * as crypto from 'crypto';

/**
 * Implementa todos os handlers da máquina de estados para a integração Meta.
 * Cada handler corresponde a um valor em bot_estado_config.handler.
 *
 * Handlers disponíveis:
 *   _handlerMensagem   — envia mensagens de texto simples
 *   _handlerCapturar   — captura entrada de texto do usuário
 *   _handlerLista      — envia menu de lista interativo (WhatsApp List Message)
 *   _handlerBotoes     — envia botões de resposta rápida (máx. 3)
 *   _handlerRequisicao — faz chamada HTTP (GET/POST) a uma API externa
 *   _handlerDelay      — aguarda um tempo antes de avançar o estado
 */
type ItemInterativoNormalizado = {
  entrada: string;
  label: string;
  descricao: string;
};

type ItemInterativoObjeto = {
  entrada?: unknown;
  label?: unknown;
  descricao?: unknown;
  description?: unknown;
  id?: unknown;
  rowId?: unknown;
  value?: unknown;
  payload?: unknown;
  title?: unknown;
  text?: unknown;
  [key: string]: unknown;
};

type MetaMessage = {
  from: string;
  [key: string]: unknown;
};

type Assignment = {
  key?: string;
  value?: unknown;
  [key: string]: unknown;
};

type CampoCaptura = {
  nome: string;
  mensagemPedir: string;
  valoresAceitos?: string[];
  mensagemInvalida?: string;
  [key: string]: unknown;
};

type HandlerConfig = Record<string, unknown> & {
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
  body?: Record<string, unknown>;
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
};

type DynamicHandler = (
  message: MetaMessage,
  chatId: string,
  corpo: string,
  engine: StateMachineEngine,
) => Promise<unknown> | unknown;

@Injectable()
export class HandlerMetaService {
  private readonly logger = new Logger(HandlerMetaService.name);

  /** Definidos pelo BotMetaService antes de cada processamento */
  public phone_id: string | null = null;
  public access_token: string | null = null;

  constructor(private estadoRepo: EstadoRepository) {}

  private parseConfig(config: unknown): HandlerConfig {
    if (typeof config === 'string') {
      try {
        return JSON.parse(config);
      } catch {
        return {};
      }
    }
    return config && typeof config === 'object'
      ? (config as HandlerConfig)
      : {};
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getHandler(handlerName: string): DynamicHandler | null {
    const candidato = (this as Record<string, unknown>)[handlerName];
    if (typeof candidato !== 'function') return null;
    return candidato as DynamicHandler;
  }

  private async executarHandler(
    handlerName: string,
    message: MetaMessage,
    chatId: string,
    engine: StateMachineEngine,
  ): Promise<void> {
    const handler = this.getHandler(handlerName);
    if (!handler) return;
    await handler.call(this, message, chatId, '', engine);
  }

  private normalizarItensInterativos(
    bruto: unknown,
    chatId: string,
    campo: 'opcoes' | 'botoes',
  ): ItemInterativoNormalizado[] {
    let itens = bruto;

    if (typeof itens === 'string') {
      try {
        itens = JSON.parse(itens);
      } catch {
        itens = [];
      }
    }

    if (this.isRecord(itens)) {
      const obj = itens;
      if (Array.isArray(obj[campo])) {
        itens = obj[campo];
      } else if (Array.isArray(obj.rows)) {
        itens = obj.rows;
      } else if (Array.isArray(obj.buttons)) {
        itens = obj.buttons;
      } else if (
        'entrada' in obj ||
        'label' in obj ||
        'id' in obj ||
        'title' in obj ||
        'text' in obj
      ) {
        itens = [obj];
      } else {
        itens = Object.values(obj);
      }
      this.logger.warn(
        `[${chatId}] Config de ${campo} recebida com formato inesperado; normalizando.`,
      );
    }

    if (!Array.isArray(itens)) {
      return [];
    }

    return itens
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          const valor = String(item).trim();
          return valor ? { entrada: valor, label: valor, descricao: '' } : null;
        }

        if (!item || typeof item !== 'object') {
          return null;
        }

        const obj = item as ItemInterativoObjeto;

        const entrada = String(
          obj.entrada ??
            obj.id ??
            obj.rowId ??
            obj.value ??
            obj.payload ??
            obj.label ??
            obj.title ??
            obj.text ??
            '',
        ).trim();
        const label = String(
          obj.label ??
            obj.title ??
            obj.text ??
            obj.entrada ??
            obj.id ??
            obj.value ??
            obj.payload ??
            '',
        ).trim();

        if (!entrada && !label) {
          return null;
        }

        return {
          entrada: entrada || label,
          label: label || entrada,
          descricao: String(obj.descricao ?? obj.description ?? '').trim(),
        };
      })
      .filter((item): item is ItemInterativoNormalizado => !!item);
  }

  // ─── Método privado: chama a Graph API da Meta ────────────────────────────

  private async chamadaMetaAPI(
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.phone_id || !this.access_token) {
      this.logger.error(
        'Meta API não inicializada: phone_id ou access_token ausente.',
      );
      return;
    }

    const url = `https://graph.facebook.com/v18.0/${this.phone_id}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        this.logger.error(
          `Erro na Meta API [${response.status}]: ${JSON.stringify(errData)}`,
        );
      } else {
        this.logger.log('Mensagem enviada com sucesso via Meta API.');
      }
    } catch (err: unknown) {
      this.logger.error(
        `Exceção ao chamar a Meta API: ${this.getErrorMessage(err)}`,
      );
    }
  }

  // ─── Helper: envia mensagem de texto simples ──────────────────────────────

  private async enviarResposta(
    message: MetaMessage,
    texto: string,
  ): Promise<void> {
    // Remove o sufixo @meta (ou @c.us) para obter o número puro
    const destino = message.from.replace(/@(meta|c\.us)$/, '');
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destino,
      type: 'text',
      text: { body: texto },
    };
    await this.chamadaMetaAPI(payload);
  }

  // ─── _handlerMensagem ─────────────────────────────────────────────────────

  /**
   * Envia uma ou mais mensagens de texto configuradas no estado.
   * Se transicaoAutomatica=true, avança automaticamente para o próximo estado.
   */
  async _handlerMensagem(
    message: MetaMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    // Como o motor já filtrou transições exatas, se houver corpo, tentamos a transição curinga (*)
    if (corpo) {
      const proximo = await engine.transitarPorEntrada(
        chatId,
        estadoAtual,
        corpo,
        message,
        true,
        null,
        this,
      );
      if (proximo) return;
    }

    const mensagens: string[] = config.mensagens ?? [];
    const dadosChat = engine.obterDados(chatId);
    for (const texto of mensagens) {
      const textoInterpolado = engine.interpolar(texto, dadosChat);
      await this.enviarResposta(message, textoInterpolado);
    }

    if (config.transicaoAutomatica || config.transicao_automatica) {
      await engine.transitarPorEntrada(
        chatId,
        estadoAtual,
        '*',
        message,
        true,
        null,
        this,
      );
    }
  }

  // ─── _handlerCapturar ─────────────────────────────────────────────────────

  /**
   * Captura texto digitado pelo usuário e avança o estado.
   * Suporta modo simples (um campo) e modo multi-campo (config.campos[]).
   */
  async _handlerCapturar(
    message: MetaMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    // Modo multi-campo
    if (Array.isArray(config.campos) && config.campos.length > 0) {
      return this._handlerCapturarMulti(
        message,
        chatId,
        corpo,
        estadoAtual,
        config,
        engine,
      );
    }

    // Modo simples: aguarda texto
    if (!corpo) {
      if (config.mensagemPedir) {
        await this.enviarResposta(message, config.mensagemPedir);
      }
      return;
    }

    let proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, corpo);
    if (
      !proximo &&
      (config.transicaoAutomatica || config.transicao_automatica)
    ) {
      proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
    }

    if (!proximo) {
      const msgInvalida =
        config.mensagemInvalida ?? '⚠️ Resposta inválida. Tente novamente.';
      await this.enviarResposta(message, msgInvalida);
      return;
    }

    const chave = config.campoSalvar || config.campoEnviar;
    if (chave) engine.salvarDado(chatId, chave, corpo);

    if (config.mensagemConfirmacao) {
      const texto = engine.interpolar(config.mensagemConfirmacao, {
        valor: corpo,
      });
      await this.enviarResposta(message, texto);
    }

    await engine.avancarEstado(chatId, proximo, corpo);

    const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
    if (configProximo) {
      await this.executarHandler(
        configProximo.handler,
        message,
        chatId,
        engine,
      );
    }
  }

  private async _handlerCapturarMulti(
    message: MetaMessage,
    chatId: string,
    corpo: string,
    estadoAtual: string,
    config: HandlerConfig,
    engine: StateMachineEngine,
  ) {
    const campos = config.campos ?? [];
    const dados = engine.obterDados(chatId);
    const proximoCampo = campos.find((c: CampoCaptura) => !(c.nome in dados));

    if (!proximoCampo) return;

    if (!corpo) {
      await this.enviarResposta(message, proximoCampo.mensagemPedir);
      return;
    }

    if (
      Array.isArray(proximoCampo.valoresAceitos) &&
      !proximoCampo.valoresAceitos.includes(corpo)
    ) {
      const msgInvalida =
        proximoCampo.mensagemInvalida ??
        config.mensagemInvalida ??
        '⚠️ Resposta inválida. Tente novamente.';
      await this.enviarResposta(message, msgInvalida);
      return;
    }

    engine.salvarDado(chatId, proximoCampo.nome, corpo);
    const dadosAtualizados = engine.obterDados(chatId);
    const proximoCampoRestante = campos.find(
      (c: CampoCaptura) => !(c.nome in dadosAtualizados),
    );

    if (proximoCampoRestante) {
      await this.enviarResposta(message, proximoCampoRestante.mensagemPedir);
      return;
    }

    if (config.mensagemConfirmacao) {
      const texto = engine.interpolar(
        config.mensagemConfirmacao,
        dadosAtualizados,
      );
      await this.enviarResposta(message, texto);
    }

    const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
    if (!proximo) return;

    await engine.avancarEstado(chatId, proximo, '[multi-captura concluída]');
    const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
    if (configProximo) {
      await this.executarHandler(
        configProximo.handler,
        message,
        chatId,
        engine,
      );
    }
  }

  // ─── _handlerLista ────────────────────────────────────────────────────────

  /**
   * Exibe um menu de Lista Interativa do WhatsApp (máx. 10 linhas).
   * Se já houver um corpo (seleção feita), navega para o próximo estado.
   * Fallback: envia lista em texto simples se a API falhar.
   *
   * Config esperada: { titulo, botaoTexto, secaoTitulo, rodape, opcoes: [{entrada, label, descricao}] }
   */
  async _handlerLista(
    message: MetaMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    // Se o usuário já enviou uma seleção, processa a transição
    if (corpo) {
      const proximo = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        corpo,
      );
      if (proximo) {
        await engine.avancarEstado(chatId, proximo, corpo);
        const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
        if (configProximo) {
          return await this.executarHandler(
            configProximo.handler,
            message,
            chatId,
            engine,
          );
        }
      } else {
        return await this.enviarResposta(
          message,
          config.mensagemInvalida ?? '⚠️ Opção inválida.',
        );
      }
    }

    // Monta o payload de lista interativa
    const opcoes = this.normalizarItensInterativos(
      config.opcoes ?? [],
      chatId,
      'opcoes',
    );
    const titulo = (config.titulo ?? 'Menu').substring(0, 1024);

    if (!opcoes.length) {
      this.logger.warn(
        `[${chatId}] _handlerLista sem opções válidas; enviando fallback em texto.`,
      );
      await this.enviarResposta(message, titulo);
      return;
    }
    const destino = message.from.replace(/@(meta|c\.us)$/, '');

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destino,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: titulo },
        action: {
          button: (config.botaoTexto ?? 'Selecione').substring(0, 20),
          sections: [
            {
              title: (config.secaoTitulo ?? 'Opções').substring(0, 24),
              rows: opcoes
                .slice(0, 10)
                .map((op: ItemInterativoNormalizado) => ({
                  id: String(op.entrada ?? op.label ?? '').substring(0, 200),
                  title: String(op.label ?? op.entrada ?? 'Opção').substring(
                    0,
                    24,
                  ),
                  description: String(op.descricao ?? '').substring(0, 72),
                })),
            },
          ],
        },
      },
    };

    if (config.rodape) {
      (payload.interactive as { footer?: { text: string } }).footer = {
        text: config.rodape.substring(0, 60),
      };
    }

    try {
      await this.chamadaMetaAPI(payload);
    } catch (err: unknown) {
      this.logger.warn(
        `[${chatId}] Fallback para texto em _handlerLista: ${this.getErrorMessage(err)}`,
      );
      const linhas = opcoes
        .map(
          (o: ItemInterativoNormalizado) =>
            `*${String(o.entrada ?? o.label ?? '')}* - ${String(
              o.label ?? o.entrada ?? 'Opção',
            )}`,
        )
        .join('\n');
      await this.enviarResposta(message, `${titulo}\n\n${linhas}`);
    }
  }

  // ─── _handlerBotoes ───────────────────────────────────────────────────────

  /**
   * Exibe botões de resposta rápida (máx. 3 pela limitação da Meta).
   * Se já houver uma seleção, navega para o próximo estado.
   *
   * Config esperada: { titulo, cabecalho, rodape, botoes: [{entrada, label}] }
   */
  async _handlerBotoes(
    message: MetaMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    // Se o usuário já clicou em um botão, processa a transição
    if (corpo) {
      const proximo = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        corpo,
      );
      if (proximo) {
        await engine.avancarEstado(chatId, proximo, corpo);
        const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
        if (configProximo) {
          await this.executarHandler(
            configProximo.handler,
            message,
            chatId,
            engine,
          );
        }
        return;
      }
    }

    // Monta o payload de botões (máx 3)
    const botoes = this.normalizarItensInterativos(
      config.botoes ?? [],
      chatId,
      'botoes',
    );
    const botoesLimitados = botoes.slice(0, 3);

    if (!botoesLimitados.length) {
      this.logger.warn(
        `[${chatId}] _handlerBotoes sem botões válidos; enviando fallback em texto.`,
      );
      await this.enviarResposta(message, config.titulo ?? 'Escolha uma opção:');
      return;
    }

    if (botoes.length > 3) {
      this.logger.warn(
        `[${chatId}] _handlerBotoes: mais de 3 botões fornecidos, limitando aos 3 primeiros.`,
      );
    }

    const destino = message.from.replace(/@(meta|c\.us)$/, '');

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destino,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: (config.titulo ?? 'Escolha uma opção:').substring(0, 1024),
        },
        action: {
          buttons: botoesLimitados.map((b: ItemInterativoNormalizado) => ({
            type: 'reply',
            reply: {
              id: String(b.entrada).substring(0, 256),
              title: String(b.label || '').substring(0, 20),
            },
          })),
        },
      },
    };

    if (config.rodape) {
      (payload.interactive as { footer?: { text: string } }).footer = {
        text: config.rodape.substring(0, 60),
      };
    }
    if (config.cabecalho) {
      (
        payload.interactive as { header?: { type: string; text: string } }
      ).header = {
        type: 'text',
        text: config.cabecalho.substring(0, 60),
      };
    }

    try {
      await this.chamadaMetaAPI(payload);
    } catch (err: unknown) {
      this.logger.error(
        `[${chatId}] Fallback para texto em _handlerBotoes: ${this.getErrorMessage(err)}`,
      );
      const linhas = botoes
        .map((b: ItemInterativoNormalizado) => b.label)
        .join('\n');
      await this.enviarResposta(message, `${config.titulo ?? ''}\n\n${linhas}`);
    }
  }

  // ─── _handlerRequisicao ───────────────────────────────────────────────────

  /**
   * Faz uma chamada HTTP (GET ou POST) a uma API externa e exibe o resultado.
   * Suporta: corpo fixo (config.body), multi-campo (config.camposEnviar[]),
   * ou campo único (config.campoEnviar).
   *
   * Config esperada:
   *   url, metodo, headers, campoResposta, mensagemSucesso,
   *   mensagemErro, mensagemNaoEncontrado, transicaoAutomatica, palavraSair
   */
  async _handlerRequisicao(
    message: MetaMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    const dadosMemoria = engine.obterDados(chatId);
    const usandoBodyFixo =
      config.body &&
      typeof config.body === 'object' &&
      !Array.isArray(config.body);
    const camposEnviar = Array.isArray(config.camposEnviar)
      ? config.camposEnviar
      : [];
    const usandoMulti = camposEnviar.length > 0;

    // Intercepta palavra de saída (ex: "sair")
    const palavraSair = (config.palavraSair ?? 'sair').toLowerCase();
    if (corpo && corpo.toLowerCase() === palavraSair) {
      const proximo = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        corpo,
      );
      if (proximo) {
        engine.limparDados(chatId);
        await engine.avancarEstado(chatId, proximo, corpo);
        const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
        if (configProximo) {
          await this.executarHandler(
            configProximo.handler,
            message,
            chatId,
            engine,
          );
        }
        return;
      }
    }

    // Se não há entrada e nem dados em memória, solicita ao usuário
    if (
      !corpo &&
      !usandoBodyFixo &&
      !usandoMulti &&
      Object.keys(dadosMemoria).length === 0
    ) {
      if (config.mensagemPedir) {
        await this.enviarResposta(message, config.mensagemPedir);
        return;
      }
    }

    let valorParaTransicao = '*';

    try {
      const metodo = (config.metodo ?? 'GET').toUpperCase();
      const from = message.from ?? chatId;
      const numero = from.replace(/@(meta|c\.us)$/, '').split('@')[0];
      const tudo: Record<string, unknown> = {
        id: crypto.randomUUID(),
        valor: corpo,
        chatId,
        from,
        numero,
        ...dadosMemoria,
      };
      const urlBase = engine.interpolar(config.url ?? '', tudo);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(config.headers ?? {}),
      };

      const interpolarDeep = (obj: unknown): unknown => {
        if (typeof obj === 'string') return engine.interpolar(obj, tudo);
        if (Array.isArray(obj)) return obj.map((item) => interpolarDeep(item));
        if (typeof obj === 'object' && obj !== null) {
          return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, interpolarDeep(v)]),
          );
        }
        return obj;
      };

      let bodyObj: Record<string, unknown>;
      if (usandoBodyFixo) {
        bodyObj = interpolarDeep(config.body) as Record<string, unknown>;
      } else if (usandoMulti) {
        bodyObj = Object.fromEntries(
          camposEnviar.map((chave: string) => [
            chave,
            dadosMemoria[chave] ?? '',
          ]),
        );
      } else if (config.campoEnviar && typeof config.campoEnviar === 'string') {
        bodyObj = {
          [config.campoEnviar]: dadosMemoria[config.campoEnviar] ?? corpo,
        };
      } else {
        bodyObj = { valor: corpo };
      }

      let resposta: unknown;
      let statusHttp: number;

      if (metodo === 'GET') {
        let urlFinal = urlBase;
        if (!usandoBodyFixo) {
          const params = new URLSearchParams(
            Object.fromEntries(
              Object.entries(bodyObj)
                .filter(([, v]) => v !== undefined && v !== '')
                .map(([k, v]) => [k, String(v)]),
            ),
          ).toString();
          if (params) urlFinal += (urlFinal.includes('?') ? '&' : '?') + params;
        }
        const res = await fetch(urlFinal, { headers });
        statusHttp = res.status;
        resposta = await res.json().catch(() => ({}));
      } else {
        const res = await fetch(urlBase, {
          method: metodo,
          headers,
          body: JSON.stringify(bodyObj),
        });
        statusHttp = res.status;
        resposta = await res.json().catch(() => ({}));
      }

      if (statusHttp !== 200) {
        await this.enviarResposta(
          message,
          config.mensagemErro ?? '❌ Erro ao processar a solicitação.',
        );
      } else {
        const valorExtraido = engine.extrairValorPath(
          resposta,
          config.campoResposta ?? '',
        );

        if (
          valorExtraido === '' ||
          valorExtraido === null ||
          valorExtraido === undefined
        ) {
          await this.enviarResposta(
            message,
            config.mensagemNaoEncontrado ?? '🤷 Não encontrado.',
          );
        } else if (Array.isArray(valorExtraido)) {
          if (valorExtraido.length === 0) {
            await this.enviarResposta(
              message,
              config.mensagemNaoEncontrado ?? '🤷 Não encontrado.',
            );
          } else {
            const separador = config.separador ?? '➖➖➖➖➖';
            const partes = valorExtraido.map((item: unknown) => {
              const objLimpo = Object.fromEntries(
                Object.entries(item as Record<string, unknown>).map(
                  ([k, v]) => [
                    k,
                    typeof v === 'string'
                      ? v.replace(/<[^>]+>/g, ' ').trim()
                      : v,
                  ],
                ),
              );
              const vars = {
                resposta: item,
                valor: corpo,
                ...dadosMemoria,
                ...objLimpo,
              };
              return engine.interpolar(
                config.mensagemSucesso ?? '✅ {{resposta}}',
                vars,
              );
            });
            await this.enviarResposta(
              message,
              partes.join(`\n\n${separador}\n\n`),
            );
          }
        } else {
          if (typeof valorExtraido !== 'object') {
            valorParaTransicao = String(valorExtraido).toLowerCase();
          }
          let variaveis: Record<string, unknown> = {
            resposta: valorExtraido,
            valor: corpo,
            ...dadosMemoria,
          };
          if (typeof valorExtraido === 'object' && valorExtraido !== null) {
            const objLimpo = Object.fromEntries(
              Object.entries(valorExtraido as Record<string, unknown>).map(
                ([k, v]) => [
                  k,
                  typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').trim() : v,
                ],
              ),
            );
            variaveis = { ...variaveis, ...objLimpo };
          }
          const msgSucesso = engine.interpolar(
            config.mensagemSucesso ?? '✅ Resposta: {{resposta}}',
            variaveis,
          );
          await this.enviarResposta(message, msgSucesso);
        }
      }
    } catch (err: unknown) {
      this.logger.error(
        `[${chatId}] Erro em _handlerRequisicao: ${this.getErrorMessage(err)}`,
      );
      await this.enviarResposta(
        message,
        config.mensagemErro ?? '❌ Erro ao processar a solicitação.',
      );
    }

    // Limpa dados da memória se necessário
    if (
      config.limparDados !== false &&
      (usandoBodyFixo || usandoMulti || config.campoSalvar)
    ) {
      engine.limparDados(chatId);
    }

    // Transição automática após a requisição
    if (config.transicaoAutomatica || config.transicao_automatica) {
      let proximo = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        valorParaTransicao,
      );
      if (!proximo && valorParaTransicao !== '*') {
        proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
      }
      if (proximo) {
        await engine.avancarEstado(chatId, proximo, corpo);
        const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
        if (configProximo) {
          await this.executarHandler(
            configProximo.handler,
            message,
            chatId,
            engine,
          );
        }
      }
    }
  }

  // ─── _handlerDelay ────────────────────────────────────────────────────────

  /**
   * Aguarda um tempo configurado antes de avançar o estado automaticamente.
   *
   * Config esperada: { mensagem, duracao, unidade: 'seconds'|'minutes' }
   * Tempo máximo: 5 minutos (300s).
   */
  async _handlerDelay(
    message: MetaMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    const duracao = config.duracao || 1;
    const unidade = config.unidade || 'seconds';
    const multiplicador = unidade === 'minutes' ? 60000 : 1000;
    const ms = duracao * multiplicador;

    if (config.mensagem) {
      await this.enviarResposta(message, config.mensagem);
    }

    const tempoReal = Math.min(ms, 300000); // máx 5 minutos
    await new Promise((resolve) => setTimeout(resolve, tempoReal));

    const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
    if (proximo) {
      await engine.avancarEstado(chatId, proximo, '[delay]');
      const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
      if (configProximo) {
        await this.executarHandler(
          configProximo.handler,
          message,
          chatId,
          engine,
        );
      }
    }
  }
}
