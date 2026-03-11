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
@Injectable()
export class HandlerService {
  private readonly logger = new Logger(HandlerService.name);

  /** Set by BotService after WPPConnect initialization */
  client: any = null;

  constructor(private estadoRepo: EstadoRepository) {}

  // ─── Helper: send response and save to DB ────────────────────────────────

  private async enviarResposta(message: any, texto: string) {
    if (!this.client) {
      this.logger.error('Client não inicializado');
      return;
    }
    try {
      const destino = message.from;
      await this.client.sendText(destino, texto);
      this.logger.log(`Resposta enviada para ${destino}`);
    } catch (err: any) {
      this.logger.error(`Erro ao enviar resposta: ${err.message}`);
    }
  }

  // ─── _handlerMensagem ────────────────────────────────────────────────────

  async _handlerMensagem(
    message: any,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config =
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};
    const mensagens = config.mensagens ?? [];

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

  // ─── _handlerCapturar ────────────────────────────────────────────────────

  async _handlerCapturar(
    message: any,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config =
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};

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
    if (
      configProximo &&
      typeof (this as any)[configProximo.handler] === 'function'
    ) {
      await (this as any)[configProximo.handler](message, chatId, '', engine);
    }
  }

  private async _handlerCapturarMulti(
    message: any,
    chatId: string,
    corpo: string,
    estadoAtual: string,
    config: any,
    engine: StateMachineEngine,
  ) {
    const campos = config.campos;
    const dados = engine.obterDados(chatId);
    const proximoCampo = campos.find((c: any) => !(c.nome in dados));

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
      (c: any) => !(c.nome in dadosAtualizados),
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
    if (
      configProximo &&
      typeof (this as any)[configProximo.handler] === 'function'
    ) {
      await (this as any)[configProximo.handler](message, chatId, '', engine);
    }
  }

  // ─── _handlerLista ───────────────────────────────────────────────────────

  async _handlerLista(
    message: any,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    let config =
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};
    if (typeof config === 'string') config = JSON.parse(config);

    if (corpo) {
      const proximo = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        corpo,
      );
      if (proximo) {
        await engine.avancarEstado(chatId, proximo, corpo);
        const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
        if (
          configProximo &&
          typeof (this as any)[configProximo.handler] === 'function'
        ) {
          return await (this as any)[configProximo.handler](
            message,
            chatId,
            '',
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

    const destino = message.from;
    const opcoes = config.opcoes ?? [];
    const titulo = config.titulo ?? 'Menu';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('sendListMessage timeout após 5s')),
        5000,
      ),
    );

    try {
      await Promise.race([
        this.client.sendListMessage(destino, {
          buttonText: config.botaoTexto || 'Selecione:',
          description: titulo,
          sections: [
            {
              title: config.secaoTitulo || 'Opções',
              rows: opcoes.map((op: any) => ({
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
    } catch (err: any) {
      this.logger.warn(`[${chatId}] Fallback texto — motivo: ${err.message}`);
      const linhas = opcoes
        .map((o: any) => `*${o.entrada}* - ${o.label}`)
        .join('\n');
      await this.enviarResposta(message, `${titulo}\n\n${linhas}`);
    }
  }

  // ─── _handlerBotoes ──────────────────────────────────────────────────────

  async _handlerBotoes(
    message: any,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config =
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};

    if (corpo) {
      const proximo = await this.estadoRepo.buscarProximoEstado(
        estadoAtual,
        corpo,
      );
      if (proximo) {
        await engine.avancarEstado(chatId, proximo, corpo);
        const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
        if (
          configProximo &&
          typeof (this as any)[configProximo.handler] === 'function'
        ) {
          await (this as any)[configProximo.handler](
            message,
            chatId,
            '',
            engine,
          );
        }
        return;
      }
    }

    try {
      await this.client.sendText(
        message.from,
        config.titulo ?? 'Escolha uma opção:',
        {
          useTemplateButtons: true,
          title: config.cabecalho ?? undefined,
          footer: config.rodape ?? undefined,
          buttons: (config.botoes ?? []).map((b: any) => ({
            id: b.entrada,
            text: b.label,
          })),
        },
      );
    } catch (err: any) {
      this.logger.error(`Erro ao enviar botões: ${err.message}`);
      const linhas = (config.botoes ?? []).map((b: any) => b.label).join('\n');
      await this.enviarResposta(message, `${config.titulo ?? ''}\n\n${linhas}`);
    }
  }

  // ─── _handlerRequisicao ──────────────────────────────────────────────────

  async _handlerRequisicao(
    message: any,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config =
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};

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
        if (
          configProximo &&
          typeof (this as any)[configProximo.handler] === 'function'
        ) {
          await (this as any)[configProximo.handler](
            message,
            chatId,
            '',
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

    try {
      const metodo = (config.metodo ?? 'GET').toUpperCase();
      const from = message.from ?? chatId;
      const numero = from.split('@')[0];
      const tudo: Record<string, any> = {
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

      const interpolarDeep = (obj: any): any => {
        if (typeof obj === 'string') return engine.interpolar(obj, tudo);
        if (Array.isArray(obj)) return obj.map((item) => interpolarDeep(item));
        if (typeof obj === 'object' && obj !== null) {
          return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, interpolarDeep(v)]),
          );
        }
        return obj;
      };

      let bodyObj: any;
      if (usandoBodyFixo) {
        bodyObj = interpolarDeep(config.body);
      } else if (usandoMulti) {
        bodyObj = Object.fromEntries(
          config.camposEnviar.map((chave: string) => [
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

      let resposta: any;
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
        resposta = await res.json();
      } else {
        const res = await fetch(urlBase, {
          method: metodo,
          headers,
          body: JSON.stringify(bodyObj),
        });
        statusHttp = res.status;
        resposta = await res.json();
      }

      if (statusHttp !== 200) {
        await this.enviarResposta(
          message,
          config.mensagemErro ?? '❌ Erro ao processar a solicitação.',
        );
      } else {
        const valorExtraido = engine.extrairValorPath(
          resposta,
          config.campoResposta,
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
            const partes = valorExtraido.map((item: any) => {
              const objLimpo = Object.fromEntries(
                Object.entries(item).map(([k, v]) => [
                  k,
                  typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').trim() : v,
                ]),
              );
              const vars = {
                resposta: item,
                valor: corpo,
                ...dadosMemoria,
                ...objLimpo,
              };
              return engine.interpolar(
                config.mensagemSucesso ?? '✅ {resposta}',
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
          let variaveis: Record<string, any> = {
            resposta: valorExtraido,
            valor: corpo,
            ...dadosMemoria,
          };
          if (typeof valorExtraido === 'object' && valorExtraido !== null) {
            const objLimpo = Object.fromEntries(
              Object.entries(valorExtraido).map(([k, v]) => [
                k,
                typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').trim() : v,
              ]),
            );
            variaveis = { ...variaveis, ...objLimpo };
          }
          const msgSucesso = engine.interpolar(
            config.mensagemSucesso ?? '✅ Resposta: {resposta}',
            variaveis,
          );
          await this.enviarResposta(message, msgSucesso);
        }
      }
    } catch (err: any) {
      this.logger.error(`Erro na requisição: ${err.message}`);
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
        await engine.avancarEstado(chatId, proximo, corpo);
        const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
        if (
          configProximo &&
          typeof (this as any)[configProximo.handler] === 'function'
        ) {
          await (this as any)[configProximo.handler](
            message,
            chatId,
            '',
            engine,
          );
        }
      }
    }
  }

  // ─── _handlerDelay ───────────────────────────────────────────────────────

  async _handlerDelay(
    message: any,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config =
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};

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
      await engine.avancarEstado(chatId, proximo, '[delay]');
      const configProximo = await this.estadoRepo.obterConfigEstado(proximo);
      if (
        configProximo &&
        typeof (this as any)[configProximo.handler] === 'function'
      ) {
        await (this as any)[configProximo.handler](message, chatId, '', engine);
      }
    }
  }
}
