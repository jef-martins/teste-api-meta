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
@Injectable()
export class HandlerMetaService {
  private readonly logger = new Logger(HandlerMetaService.name);

  /** Definidos pelo BotMetaService antes de cada processamento */
  public phone_id: string | null = null;
  public access_token: string | null = null;

  constructor(private estadoRepo: EstadoRepository) {}

  // ─── Método privado: chama a Graph API da Meta ────────────────────────────

  private async chamadaMetaAPI(payload: any): Promise<void> {
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
    } catch (err: any) {
      this.logger.error(`Exceção ao chamar a Meta API: ${err.message}`);
    }
  }

  // ─── Helper: envia mensagem de texto simples ──────────────────────────────

  private async enviarResposta(message: any, texto: string): Promise<void> {
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
    message: any,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config =
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};
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
        this as any,
      );
    }
  }

  // ─── _handlerCapturar ─────────────────────────────────────────────────────

  /**
   * Captura texto digitado pelo usuário e avança o estado.
   * Suporta modo simples (um campo) e modo multi-campo (config.campos[]).
   */
  async _handlerCapturar(
    message: any,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config =
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};

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
    if (!proximo && (config.transicaoAutomatica || config.transicao_automatica)) {
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

  // ─── _handlerLista ────────────────────────────────────────────────────────

  /**
   * Exibe um menu de Lista Interativa do WhatsApp (máx. 10 linhas).
   * Se já houver um corpo (seleção feita), navega para o próximo estado.
   * Fallback: envia lista em texto simples se a API falhar.
   *
   * Config esperada: { titulo, botaoTexto, secaoTitulo, rodape, opcoes: [{entrada, label, descricao}] }
   */
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

    // Se o usuário já enviou uma seleção, processa a transição
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

    // Monta o payload de lista interativa
    const opcoes = config.opcoes ?? [];
    const titulo = (config.titulo ?? 'Menu').substring(0, 1024);
    const destino = message.from.replace(/@(meta|c\.us)$/, '');

    const payload: any = {
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
              rows: opcoes.slice(0, 10).map((op: any) => ({
                id: String(op.entrada).substring(0, 200),
                title: op.label.substring(0, 24),
                description: (op.descricao || '').substring(0, 72),
              })),
            },
          ],
        },
      },
    };

    if (config.rodape) {
      payload.interactive.footer = { text: config.rodape.substring(0, 60) };
    }

    try {
      await this.chamadaMetaAPI(payload);
    } catch (err: any) {
      this.logger.warn(
        `[${chatId}] Fallback para texto em _handlerLista: ${err.message}`,
      );
      const linhas = opcoes
        .map((o: any) => `*${o.entrada}* - ${o.label}`)
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
    message: any,
    chatId: string,
    corpo: string,
    engine: StateMachineEngine,
  ) {
    const estadoAtual = engine.estadosUsuarios.get(chatId)!;
    const config =
      (await this.estadoRepo.obterConfigEstado(estadoAtual))?.config ?? {};

    // Se o usuário já clicou em um botão, processa a transição
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

    const botoes = config.botoes ?? [];
    const botoesLimitados = botoes.slice(0, 3);

    if (botoes.length > 3) {
      this.logger.warn(
        `[${chatId}] _handlerBotoes: mais de 3 botões fornecidos, limitando aos 3 primeiros.`,
      );
    }

    const destino = message.from.replace(/@(meta|c\.us)$/, '');

    const payload: any = {
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
          buttons: botoesLimitados.map((b: any) => ({
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
      payload.interactive.footer = { text: config.rodape.substring(0, 60) };
    }
    if (config.cabecalho) {
      payload.interactive.header = {
        type: 'text',
        text: config.cabecalho.substring(0, 60),
      };
    }

    try {
      await this.chamadaMetaAPI(payload);
    } catch (err: any) {
      this.logger.error(
        `[${chatId}] Fallback para texto em _handlerBotoes: ${err.message}`,
      );
      const linhas = botoes.map((b: any) => b.label).join('\n');
      await this.enviarResposta(
        message,
        `${config.titulo ?? ''}\n\n${linhas}`,
      );
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
          config.campoResposta,
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
      this.logger.error(
        `[${chatId}] Erro em _handlerRequisicao: ${err.message}`,
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

  // ─── _handlerDelay ────────────────────────────────────────────────────────

  /**
   * Aguarda um tempo configurado antes de avançar o estado automaticamente.
   *
   * Config esperada: { mensagem, duracao, unidade: 'seconds'|'minutes' }
   * Tempo máximo: 5 minutos (300s).
   */
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

    const tempoReal = Math.min(ms, 300000); // máx 5 minutos
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
