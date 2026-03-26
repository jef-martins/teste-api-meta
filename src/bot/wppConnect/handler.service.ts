import { Injectable, Logger } from '@nestjs/common';
import { EstadoRepository } from '../estado.repository';
import { StateMachineEngine } from '../state-machine.engine';
import * as crypto from 'crypto';

/**
 * Implements all step handlers for the bot state machine.
 * Each handler corresponds to a value in bot_estado_config.handler.
 *
 * Handlers: _handlerMensagem, _handlerCapturar, _handlerLista,
 *           _handlerBotoes, _handlerRequisicao, _handlerDelay
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
type HandlerMessage = {
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

type WppClient = {
  sendText: (destino: string, texto: string) => Promise<unknown>;
  sendListMessage?: (destino: string, payload: unknown) => Promise<unknown>;
};

type DynamicHandler = (
  message: HandlerMessage,
  chatId: string,
  corpo: string,
  engine: StateMachineEngine,
) => Promise<unknown> | unknown;

@Injectable()
export class HandlerService {
  private readonly logger = new Logger(HandlerService.name);

  /** Set by BotService after WPPConnect initialization */
  client: WppClient = { sendText: async () => undefined };

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
    message: HandlerMessage,
    chatId: string,
    engine: StateMachineEngine,
  ): Promise<void> {
    const handler = this.getHandler(handlerName);
    if (!handler) return;
    await handler.call(this, message, chatId, '', engine);
  }

  private normalizarItensInterativos(
    bruto: unknown,
    campo: 'opcoes' | 'botoes',
  ): ItemInterativoNormalizado[] {
    let itens: unknown = bruto;

    if (typeof itens === 'string') {
      try {
        itens = JSON.parse(itens);
      } catch {
        itens = [];
      }
    }

    if (itens && typeof itens === 'object' && !Array.isArray(itens)) {
      const obj = itens as Record<string, unknown>;

      if (Array.isArray(obj[campo])) {
        itens = obj[campo];
      } else if (Array.isArray(obj.rows)) {
        itens = obj.rows;
      } else if (Array.isArray(obj.buttons)) {
        itens = obj.buttons;
      } else if (this.pareceItemInterativo(obj)) {
        itens = [obj];
      } else {
        itens = Object.values(obj);
      }
    }

    if (!Array.isArray(itens)) {
      return [];
    }

    return itens
      .map((item) => this.normalizarItemInterativo(item))
      .filter((item): item is ItemInterativoNormalizado => !!item);
  }

  private pareceItemInterativo(obj: Record<string, unknown>): boolean {
    return (
      'entrada' in obj ||
      'label' in obj ||
      'id' in obj ||
      'title' in obj ||
      'text' in obj
    );
  }

  private normalizarItemInterativo(
    item: unknown,
  ): ItemInterativoNormalizado | null {
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
  }

  // ─── Helper: advance to next state and execute its handler ──────────────

  private async avancarEExecutar(
    proximo: string,
    message: HandlerMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
    gatilho?: string,
  ) {
    await engine.avancarEstado(chatId, proximo, gatilho ?? corpo);
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

  // ─── Helper: strip HTML tags from object values ──────────────────────────

  private limparHtml(obj: unknown): Record<string, unknown> {
    if (!this.isRecord(obj)) return {};
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').trim() : v,
      ]),
    );
  }

  // ─── Helper: send response and save to DB ────────────────────────────────

  private async enviarResposta(message: HandlerMessage, texto: string) {
    if (!this.client?.sendText) {
      this.logger.error('Client não inicializado');
      return;
    }
    try {
      const destino = message.from;
      await this.client.sendText(destino, texto);
      this.logger.log(`Resposta enviada para ${destino}`);
    } catch (err: unknown) {
      this.logger.error(
        `Erro ao enviar resposta: ${this.getErrorMessage(err)}`,
      );
    }
  }

  // ─── _handlerMensagem ────────────────────────────────────────────────────

  async _handlerMensagem(
    message: HandlerMessage,
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

    const mensagens = config.mensagens ?? [];
    const dadosChat = engine.obterDados(chatId);
    for (const texto of mensagens) {
      const textoInterpolado = engine.interpolar(texto, dadosChat);
      await this.enviarResposta(message, textoInterpolado);
    }

    // Processar assignments de setVariable (sub-componentes inline)
    const assignments = config.assignments ?? [];
    if (assignments.length > 0) {
      const dadosAtuais = engine.obterDados(chatId);
      for (const assignment of assignments) {
        const key = assignment.key;
        const rawValue = assignment.value ?? '';
        const interpolado = engine.interpolar(String(rawValue), dadosAtuais);
        if (key) engine.salvarDado(chatId, key, interpolado);
      }
      this.logger.log(
        `[${chatId}] mensagem+setVariable: ${assignments.map((a: Assignment) => a.key).join(', ')}`,
      );
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
      return;
    }

    // Nós que não têm transicaoAutomatica (ex: END dentro de um componente personalizado)
    // mas possuem uma transição '*' de saída devem avançar automaticamente quando
    // chamados via auto-transição (corpo vazio). Isso evita que o bot fique aguardando
    // input do usuário ao sair de um componente que não tem "Aguardar resposta".
    if (!corpo) {
      const proximoAuto = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        '*',
      );
      if (proximoAuto) {
        await this.avancarEExecutar(
          proximoAuto,
          message,
          chatId,
          '',
          engine,
          '[auto-exit]',
        );
      }
    }
  }

  // ─── _handlerCapturar ────────────────────────────────────────────────────

  async _handlerCapturar(
    message: HandlerMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    // Multi-field mode
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

    // Simple mode
    if (!corpo) {
      if (config.mensagemPedir) {
        const dadosChat = engine.obterDados(chatId);
        const textoInterpolado = engine.interpolar(
          config.mensagemPedir,
          dadosChat,
        );
        await this.enviarResposta(message, textoInterpolado);
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

    // Processar assignments de setVariable (se houver junto com waitForResponse)
    const captureAssignments = config.assignments ?? [];
    if (captureAssignments.length > 0) {
      const dadosAtuais = engine.obterDados(chatId);
      for (const assignment of captureAssignments) {
        const key = assignment.key;
        const rawValue = assignment.value ?? '';
        const interpolado = engine.interpolar(String(rawValue), dadosAtuais);
        if (key) engine.salvarDado(chatId, key, interpolado);
      }
    }

    if (config.mensagemConfirmacao) {
      const texto = engine.interpolar(config.mensagemConfirmacao, {
        valor: corpo,
      });
      await this.enviarResposta(message, texto);
    }

    await this.avancarEExecutar(proximo, message, chatId, corpo, engine);
  }

  private async _handlerCapturarMulti(
    message: HandlerMessage,
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
      const textoInterpolado = engine.interpolar(
        proximoCampo.mensagemPedir,
        dados,
      );
      await this.enviarResposta(message, textoInterpolado);
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

    await this.avancarEExecutar(
      proximo,
      message,
      chatId,
      corpo,
      engine,
      '[multi-captura concluída]',
    );
  }

  // ─── _handlerLista ───────────────────────────────────────────────────────

  async _handlerLista(
    message: HandlerMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    if (corpo) {
      let proximo = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        corpo,
      );

      // Fallback: match by option label (for clients that return label text instead of rowId)
      if (!proximo) {
        const opcoes = this.normalizarItensInterativos(
          config.opcoes ?? [],
          'opcoes',
        );
        const match = opcoes.find(
          (o: ItemInterativoNormalizado) =>
            (o.label || '').toLowerCase() === corpo.toLowerCase(),
        );
        if (match) {
          proximo = await this.estadoRepo.buscarProximoEstado(
            estadoAtual,
            match.entrada,
          );
        }
      }

      if (proximo) {
        return await this.avancarEExecutar(
          proximo,
          message,
          chatId,
          '',
          engine,
          corpo,
        );
      }

      // Fallback: try the default/padrão (*) transition
      const proximoPadrao = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        '*',
      );
      if (proximoPadrao) {
        return await this.avancarEExecutar(
          proximoPadrao,
          message,
          chatId,
          '',
          engine,
          corpo,
        );
      }

      return await this.enviarResposta(
        message,
        config.mensagemInvalida ?? '⚠️ Opção inválida.',
      );
    }

    const destino = message.from;
    const opcoes = this.normalizarItensInterativos(
      config.opcoes ?? [],
      'opcoes',
    );
    const titulo = config.titulo ?? 'Menu';

    if (!opcoes.length) {
      await this.enviarResposta(message, titulo);
      return;
    }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('sendListMessage timeout após 5s')),
        5000,
      ),
    );

    try {
      await Promise.race([
        this.client.sendListMessage!(destino, {
          buttonText: config.botaoTexto || 'Selecione:',
          description: titulo,
          sections: [
            {
              title: config.secaoTitulo || 'Opções',
              rows: opcoes.map((op: ItemInterativoNormalizado) => ({
                rowId: String(op.entrada),
                title: op.label,
                description: op.descricao || '',
              })),
            },
          ],
          footer: config.rodape || '',
        }),
        timeout,
      ]);
    } catch (err: unknown) {
      this.logger.warn(
        `[${chatId}] Fallback texto — motivo: ${this.getErrorMessage(err)}`,
      );
      const linhas = opcoes
        .map((o: ItemInterativoNormalizado) => `*${o.entrada}* - ${o.label}`)
        .join('\n');
      await this.enviarResposta(message, `${titulo}\n\n${linhas}`);
    }
  }

  // ─── _handlerBotoes ──────────────────────────────────────────────────────

  async _handlerBotoes(
    message: HandlerMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    if (corpo) {
      let proximo = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        corpo,
      );

      // Fallback: match by button label (for text replies of buttons)
      if (!proximo) {
        const botoes = this.normalizarItensInterativos(
          config.botoes ?? [],
          'botoes',
        );
        const match = botoes.find(
          (b: ItemInterativoNormalizado) =>
            (b.label || '').toLowerCase() === corpo.toLowerCase(),
        );
        if (match) {
          proximo = await this.estadoRepo.buscarProximoEstado(
            estadoAtual,
            match.entrada,
          );
        }
      }

      if (proximo) {
        await this.avancarEExecutar(
          proximo,
          message,
          chatId,
          '',
          engine,
          corpo,
        );
        return;
      }

      // Fallback: try the default/padrão (*) transition
      const proximoPadrao = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        '*',
      );
      if (proximoPadrao) {
        await this.avancarEExecutar(
          proximoPadrao,
          message,
          chatId,
          '',
          engine,
          corpo,
        );
        return;
      }
    }

    const botoes = this.normalizarItensInterativos(
      config.botoes ?? [],
      'botoes',
    );

    if (!botoes.length) {
      await this.enviarResposta(message, config.titulo ?? 'Escolha uma opção:');
      return;
    }

    try {
      const linhas = (config.botoes ?? [])
        .map((b: ItemInterativoNormalizado) => `*${b.entrada}* - ${b.label}`)
        .join('\n');
      const rodape = config.rodape ? `\n\n_${config.rodape}_` : '';
      const cabecalho = config.cabecalho ? `*${config.cabecalho}*\n\n` : '';

      await this.client.sendText(
        message.from,
        `${cabecalho}${config.titulo ?? 'Escolha uma opção:'}\n\n${linhas}${rodape}`,
      );
    } catch (err: unknown) {
      this.logger.error(`Erro ao enviar botões: ${this.getErrorMessage(err)}`);
      const linhas = (config.botoes ?? [])
        .map((b: ItemInterativoNormalizado) => `*${b.entrada}* - ${b.label}`)
        .join('\n');
      await this.enviarResposta(message, `${config.titulo ?? ''}\n\n${linhas}`);
    }
  }

  // ─── _handlerRequisicao ──────────────────────────────────────────────────

  async _handlerRequisicao(
    message: HandlerMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    let config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    const dadosMemoria = engine.obterDados(chatId);
    const usandoBodyFixo =
      config.body &&
      typeof config.body === 'object' &&
      !Array.isArray(config.body);
    const usandoMulti =
      Array.isArray(config.camposEnviar) && config.camposEnviar.length > 0;

    // Intercept exit word
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

    // Resolver apiRoute registrada (apiId + routeId) em runtime
    if (config.apiId && config.routeId) {
      const rota = await this.estadoRepo.obterRotaApi(
        config.apiId,
        config.routeId,
      );
      if (!rota) {
        await this.enviarResposta(
          message,
          config.mensagemErro ?? '❌ Rota de API não encontrada.',
        );
        return;
      }
      config = {
        ...config,
        url: rota.url,
        metodo: rota.metodo,
        headers: rota.headers,
      };
    }

    try {
      const metodo = (config.metodo ?? 'GET').toUpperCase();
      const from = message.from ?? chatId;
      const numero = from.split('@')[0];
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
          (config.camposEnviar ?? []).map((chave: string) => [
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

      let respostaBody: unknown;
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
        respostaBody = await res.json();
      } else {
        const res = await fetch(urlBase, {
          method: metodo,
          headers,
          body: JSON.stringify(bodyObj),
        });
        statusHttp = res.status;
        respostaBody = await res.json();
      }

      const respostaTexto = JSON.stringify(respostaBody);

      // Salva a resposta completa na variável nomeada (acessível em estados seguintes)
      const nomeVariavel = config.variavelResposta || config.campoResposta;
      if (nomeVariavel) {
        engine.salvarDado(chatId, nomeVariavel, respostaTexto);
      }

      if (statusHttp !== 200) {
        await this.enviarResposta(
          message,
          config.mensagemErro ?? '❌ Erro ao processar a solicitação.',
        );
      } else {
        const valorExtraido = engine.extrairValorPath(
          respostaBody,
          config.campoResposta ?? '',
        );

        if (
          valorExtraido === '' ||
          valorExtraido === null ||
          valorExtraido === undefined
        ) {
          await this.enviarResposta(
            message,
            config.mensagemNaoEncontrado ?? '🤷‍♂️ Não encontrado.',
          );
        } else if (Array.isArray(valorExtraido)) {
          if (valorExtraido.length === 0) {
            await this.enviarResposta(
              message,
              config.mensagemNaoEncontrado ?? '🤷‍♂️ Não encontrado.',
            );
          } else {
            const separador = config.separador ?? '➖➖➖➖➖';
            const partes = valorExtraido.map((item: unknown) => {
              const objLimpo = this.limparHtml(item);
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
            variaveis = { ...variaveis, ...this.limparHtml(valorExtraido) };
          }
          const msgSucesso = engine.interpolar(
            config.mensagemSucesso ?? '✅ Resposta: {{resposta}}',
            variaveis,
          );
          await this.enviarResposta(message, msgSucesso);
        }
      }
    } catch (err: unknown) {
      this.logger.error(`Erro na requisição: ${this.getErrorMessage(err)}`);
      await this.enviarResposta(
        message,
        config.mensagemErro ?? '❌ Erro ao processar a solicitação.',
      );
    }

    if (
      config.limparDados !== false &&
      (usandoBodyFixo || usandoMulti || config.campoSalvar)
    ) {
      engine.limparDados(chatId);
    }

    if (config.transicaoAutomatica || config.transicao_automatica) {
      let proximo = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        valorParaTransicao,
      );
      if (!proximo && valorParaTransicao !== '*') {
        proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
      }
      if (proximo) {
        await this.avancarEExecutar(
          proximo,
          message,
          chatId,
          '',
          engine,
          corpo,
        );
      }
    }
  }

  // ─── _handlerSetVariable ────────────────────────────────────────────────

  async _handlerSetVariable(
    message: HandlerMessage,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config = this.parseConfig(
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {},
    );

    const assignments = config.assignments ?? [];
    const dadosChat = engine.obterDados(chatId);

    for (const assignment of assignments) {
      const key = assignment.key;
      const rawValue = assignment.value ?? '';
      const interpolado = engine.interpolar(String(rawValue), dadosChat);
      if (key) engine.salvarDado(chatId, key, interpolado);
    }

    if (assignments.length > 0) {
      this.logger.log(
        `[${chatId}] setVariable: ${assignments.map((a: Assignment) => a.key).join(', ')}`,
      );
    }

    // Transição automática
    const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
    if (proximo) {
      await this.avancarEExecutar(
        proximo,
        message,
        chatId,
        '',
        engine,
        '[setVariable]',
      );
    }
  }

  // ─── _handlerDelay ───────────────────────────────────────────────────────

  async _handlerDelay(
    message: HandlerMessage,
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

    const tempoReal = Math.min(ms, 300000);
    await new Promise((resolve) => setTimeout(resolve, tempoReal));

    const proximo = await this.estadoRepo.buscarProximoEstado(estadoAtual, '*');
    if (proximo) {
      await this.avancarEExecutar(
        proximo,
        message,
        chatId,
        '',
        engine,
        '[delay]',
      );
    }
  }
}
