const Bot        = require('./Bot');
const estadoRepository = require('../database/estadoRepository');

// ─────────────────────────────────────────────────────────────────────────────
//
// Herda de Bot (motor de persistência WPPConnect).
// Implementa steps genéricos controlados 100% pelo campo `config` na tabela
// bot_estado_config. Para adicionar ou alterar um passo do fluxo, basta
// editar o banco — sem alterar código JS.
//
// Steps disponíveis (valor do campo `handler` no banco):
//   _handlerMensagem   → envia 1 ou mais mensagens e opcionalmente avança
//   _handlerCapturar   → pede uma informação e processa na próxima mensagem
//   _handlerLista      → exibe opções numeradas e roteia pela tabela de transições
//   _handlerBotoes     → envia mensagem com botões interativos (WPP)
//   _handlerRequisicao → faz requisição HTTP e exibe a resposta formatada
// ─────────────────────────────────────────────────────────────────────────────

class Handler extends Bot {

    // ─────────────────────────────────────────────────────────────────────────
    // STEP: _handlerMensagem
    //
    // Envia uma ou mais mensagens em sequência.
    // Se config.transicaoAutomatica = true, avança via transição '*' no banco.
    //
    // config esperado:
    // {
    //   "mensagens": ["texto1", "texto2"],
    //   "transicaoAutomatica": true
    // }
    // ─────────────────────────────────────────────────────────────────────────

    async _handlerMensagem(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config      = (await estadoRepository.obterConfigEstado(estadoAtual))?.config ?? {};
        const mensagens   = config.mensagens ?? [];

        for (const texto of mensagens) {
            await this.enviarResposta(message, texto);
        }

        if (config.transicaoAutomatica || config.transicao_automatica) {
            await engine.transitarPorEntrada(chatId, estadoAtual, '*', message, true);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP: _handlerCapturar
    //
    // Coleta UMA ou MAIS informações do usuário, uma por vez.
    // Os valores são armazenados em memória (engine.dadosCapturados) pelo chatId.
    //
    // ── Modo simples (um campo só): igual ao comportamento anterior ──
    // {
    //   "mensagemPedir":       "Digite o protocolo:",
    //   "mensagemConfirmacao": "Consultando *{valor}*...",
    //   "mensagemInvalida":    "Resposta inválida. Tente novamente.",
    //   "campoSalvar":         "protocolo",   ← opcional: salva na memória com essa chave
    //   "transicaoAutomatica": true
    // }
    //
    // ── Modo multi-campo (coleta vários campos em sequência) ──
    // {
    //   "campos": [
    //     { "nome": "assunto",   "mensagemPedir": "Qual o assunto?" },
    //     { "nome": "descricao", "mensagemPedir": "Descreva o problema:" },
    //     { "nome": "contato",   "mensagemPedir": "Seu telefone:" }
    //   ],
    //   "mensagemConfirmacao": "Criando protocolo com: {assunto}, {descricao}, {contato}…",
    //   "transicaoAutomatica": true
    // }
    //
    // Após todos os campos preenchidos, avança via transição '*'.
    // O _handlerRequisicao lê os dados da memória automaticamente.
    // ─────────────────────────────────────────────────────────────────────────

    async _handlerCapturar(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config      = (await estadoRepository.obterConfigEstado(estadoAtual))?.config ?? {};

        // ── Modo multi-campo: config.campos é um array ──
        if (Array.isArray(config.campos) && config.campos.length > 0) {
            return await this._handlerCapturarMulti(message, chatId, corpo, estadoAtual, config, engine);
        }

        // ── Modo simples (comportamento original) ──

        // Sem valor ainda: pede a informação e aguarda
        if (!corpo) {
            if (config.mensagemPedir) {
                await this.enviarResposta(message, config.mensagemPedir);
            }
            return;
        }

        // Valor recebido: verifica se existe transição
        let proximo = await estadoRepository.buscarProximoEstado(estadoAtual, corpo);
        if (!proximo && (config.transicaoAutomatica || config.transicao_automatica)) {
            proximo = await estadoRepository.buscarProximoEstado(estadoAtual, '*');
        }

        if (!proximo) {
            const msgInvalida = config.mensagemInvalida ?? '⚠️ Resposta inválida. Tente novamente.';
            await this.enviarResposta(message, msgInvalida);
            return;
        }

        // Salva o valor na memória SOMENTE se campoSalvar estiver explicitamente configurado
        const chave = config.campoSalvar || config.campoEnviar;
        if (chave) engine.salvarDado(chatId, chave, corpo);

        // Confirmação antes de avançar
        if (config.mensagemConfirmacao) {
            const texto = engine.interpolar(config.mensagemConfirmacao, { valor: corpo });
            await this.enviarResposta(message, texto);
        }

        await engine.avancarEstado(chatId, proximo, corpo);

        // Executa o handler do próximo estado
        const configProximo = await estadoRepository.obterConfigEstado(proximo);
        if (configProximo && typeof this[configProximo.handler] === 'function') {
            await this[configProximo.handler](message, chatId, '', engine);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lógica interna de captura multi-campo (chamada pelo _handlerCapturar)
    // ─────────────────────────────────────────────────────────────────────────

    async _handlerCapturarMulti(message, chatId, corpo, estadoAtual, config, engine) {
        const campos = config.campos;
        const dados  = engine.obterDados(chatId);

        // Descobre qual é o próximo campo ainda não preenchido
        const proximoCampo = campos.find(c => !(c.nome in dados));

        if (!proximoCampo) {
            // Todos os campos já preenchidos — segurança caso o estado seja re-executado
            console.warn(`[Bot] [${chatId}] _handlerCapturarMulti: todos os campos já preenchidos.`);
            return;
        }

        // Primeiro acesso ao estado (corpo vazio) ou retorno: pede o campo pendente
        if (!corpo) {
            await this.enviarResposta(message, proximoCampo.mensagemPedir);
            return;
        }

        // Validação opcional por lista de valores aceitos
        if (Array.isArray(proximoCampo.valoresAceitos) && !proximoCampo.valoresAceitos.includes(corpo)) {
            const msgInvalida = proximoCampo.mensagemInvalida ?? config.mensagemInvalida ?? '⚠️ Resposta inválida. Tente novamente.';
            await this.enviarResposta(message, msgInvalida);
            return;
        }

        // Salva o valor na memória com o nome do campo
        engine.salvarDado(chatId, proximoCampo.nome, corpo);
        const dadosAtualizados = engine.obterDados(chatId);

        // Verifica se ainda há campos por preencher
        const proximoCampoRestante = campos.find(c => !(c.nome in dadosAtualizados));

        if (proximoCampoRestante) {
            // Ainda há mais campos: pede o próximo
            await this.enviarResposta(message, proximoCampoRestante.mensagemPedir);
            return;
        }

        // ── Todos os campos preenchidos: confirma e avança ──
        if (config.mensagemConfirmacao) {
            const texto = engine.interpolar(config.mensagemConfirmacao, dadosAtualizados);
            await this.enviarResposta(message, texto);
        }

        const proximo = await estadoRepository.buscarProximoEstado(estadoAtual, '*');
        if (!proximo) {
            console.warn(`[Bot] [${chatId}] _handlerCapturarMulti: nenhuma transição '*' configurada para ${estadoAtual}.`);
            return;
        }

        await engine.avancarEstado(chatId, proximo, '[multi-captura concluída]');

        const configProximo = await estadoRepository.obterConfigEstado(proximo);
        if (configProximo && typeof this[configProximo.handler] === 'function') {
            await this[configProximo.handler](message, chatId, '', engine);
        }
    }


    // ─────────────────────────────────────────────────────────────────────────
    // STEP: _handlerLista
    //
    // Envia uma lista interativa (WhatsApp List Message) via sendListMessage.
    // Quando o usuário seleciona um item, chega message.type='list_response'
    // e message.selectedRowId = o valor do campo `entrada` da opção escolhida.
    //
    // config esperado:
    // {
    //   "titulo"      : "🔧 *Como posso te ajudar?*",  ← corpo da mensagem
    //   "botaoTexto"  : "Selecione:",                   ← texto do botão de abrir a lista
    //   "secaoTitulo" : "Opções",                        ← título da seção dentro da lista
    //   "opcoes"      : [
    //       { "entrada": "1", "label": "Consulta de Protocolo" },
    //       { "entrada": "2", "label": "Garantia de Produto"  }
    //   ],
    //   "rodape"         : "Telecontrol Atendimento",
    //   "mensagemInvalida": "⚠️ Opção inválida."
    // }
    // ─────────────────────────────────────────────────────────────────────────

    async _handlerLista(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        let config = (await estadoRepository.obterConfigEstado(estadoAtual))?.config ?? {};

        if (typeof config === 'string') config = JSON.parse(config);

        // 1. Se recebemos uma resposta da lista
        if (corpo) {
            const proximo = await estadoRepository.buscarProximoEstado(estadoAtual, corpo);
            if (proximo) {
                await engine.avancarEstado(chatId, proximo, corpo);
                const configProximo = await estadoRepository.obterConfigEstado(proximo);
                if (configProximo && typeof this[configProximo.handler] === 'function') {
                    return await this[configProximo.handler](message, chatId, '', engine);
                }
            } else {
                return await this.enviarResposta(message, config.mensagemInvalida ?? '⚠️ Opção inválida.');
            }
        }

        // 2. Envio da Lista com timeout de 5s
        // sendListMessage pode pendurar indefinidamente — o timeout garante o fallback
        const destino  = message.from; // usa message.from diretamente (funciona com @lid)
        const opcoes   = config.opcoes ?? [];
        const titulo   = config.titulo ?? 'Menu';

        console.log(`[Bot] [${chatId}] sendListMessage → destino=${destino} | opções=${opcoes.length}`);

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('sendListMessage timeout após 5s')), 5000)
        );

        try {
            await Promise.race([
                this.client.sendListMessage(destino, {
                    buttonText:  config.botaoTexto  || 'Selecione:',
                    description: titulo,
                    sections: [{
                        title: config.secaoTitulo || 'Opções',
                        rows:  opcoes.map(op => ({
                            rowId:       String(op.entrada),
                            title:       op.label,
                            description: op.descricao || '',
                        })),
                    }],
                    footer: config.rodape || '',
                }),
                timeout,
            ]);
            console.log(`[Bot] [${chatId}] Lista interativa enviada.`);
        } catch (err) {
            console.warn(`[Bot] [${chatId}] Fallback texto — motivo: ${err.message}`);
            const linhas = opcoes.map(o => `*${o.entrada}* - ${o.label}`).join('\n');
            await this.enviarResposta(message, `${titulo}\n\n${linhas}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP: _handlerBotoes
    //
    // Envia uma mensagem com botões interativos via sendText + useTemplateButtons.
    // Quando o usuário toca um botão, chega como message.type='buttons_response'
    // e message.selectedButtonId = o id do botão configurado.
    //
    // config esperado:
    // {
    //   "titulo"   : "Posso te ajudar com algo mais?",   ← corpo da mensagem
    //   "cabecalho": "Sua interação foi registrada.",     ← título acima (opcional)
    //   "rodape"   : "Telecontrol Atendimento",           ← rodapé (opcional)
    //   "botoes"   : [
    //       { "entrada": "menu",      "label": "Menu Inicial" },
    //       { "entrada": "encerrar",  "label": "Finalizar"    }
    //   ]
    // }
    // ─────────────────────────────────────────────────────────────────────────

    async _handlerBotoes(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config      = (await estadoRepository.obterConfigEstado(estadoAtual))?.config ?? {};

        // ── Botão pressionado (selectedButtonId mapeado no process da Engine) ──
        if (corpo) {
            const proximo = await estadoRepository.buscarProximoEstado(estadoAtual, corpo);

            if (proximo) {
                await engine.avancarEstado(chatId, proximo, corpo);
                const configProximo = await estadoRepository.obterConfigEstado(proximo);
                if (configProximo && typeof this[configProximo.handler] === 'function') {
                    await this[configProximo.handler](message, chatId, '', engine);
                }
                return;
            }
        }

        // ── Envia botões interativos ──
        try {
            await this.client.sendText(message.from, config.titulo ?? 'Escolha uma opção:', {
                useTemplateButtons: true,
                title:   config.cabecalho ?? undefined,
                footer:  config.rodape    ?? undefined,
                buttons: (config.botoes ?? []).map(b => ({
                    id:   b.entrada,
                    text: b.label,
                })),
            });
            console.log(`[Bot] [${chatId}] Botões interativos enviados.`);
        } catch (err) {
            console.error('[Bot] Erro ao enviar botões:', err.message);
            // Fallback: texto simples
            const linhas = (config.botoes ?? []).map(b => b.label).join('\n');
            await this.enviarResposta(message, `${config.titulo ?? ''}\n\n${linhas}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP: _handlerRequisicao
    //
    // Faz uma requisição HTTP, exibe a resposta formatada e avança o estado.
    // Integra-se com o _handlerCapturar: lê os dados capturados em memória
    // (engine.dadosCapturados) e os envia automaticamente no body/query.
    //
    // ── Modos de montagem do body/url ──
    //
    // 1. body fixo no banco (config.body = objeto):
    //    Cada valor string é interpolado com { valor, ...dadosMemoria }.
    //    Ideal para POST com muitos campos fixos + alguns dinâmicos.
    //    Ex: "body": { "nome": "{nome}", "cpf_cnpj": "{cpf}", ... }
    //
    // 2. multi-campo (config.camposEnviar = array de strings):
    //    Monta o body apenas com os campos listados, lidos da memória.
    //    Ex: "camposEnviar": ["assunto", "descricao"]
    //
    // 3. campo simples (config.campoEnviar = string):
    //    Monta body como { [campoEnviar]: valor }.
    //    Ex: "campoEnviar": "protocolo"
    //
    // 4. fallback: body = { valor: corpo } (entrada bruta do usuário)
    //
    // Qualquer modo aceita "transicaoAutomatica": true para avançar após a req.
    // ─────────────────────────────────────────────────────────────────────────

    async _handlerRequisicao(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config      = (await estadoRepository.obterConfigEstado(estadoAtual))?.config ?? {};

        const dadosMemoria   = engine.obterDados(chatId);
        const usandoBodyFixo = config.body && typeof config.body === 'object' && !Array.isArray(config.body);
        const usandoMulti    = Array.isArray(config.camposEnviar) && config.camposEnviar.length > 0;

        // ── Gera um UUID v4 fresco para substituir {id} em qualquer parte da requisição ──
        const gerarUUID = () => require('crypto').randomUUID();

        // ── Intercepta a palavra de saída ANTES de fazer a requisição ──
        // Se o usuário digitou "sair" (ou a palavra configurada), busca a transição diretamente
        // e NÃO envia nada para a API externa.
        const palavraSair = (config.palavraSair ?? 'sair').toLowerCase();
        if (corpo && corpo.toLowerCase() === palavraSair) {
            const proximo = await estadoRepository.buscarProximoEstado(estadoAtual, corpo);
            if (proximo) {
                engine.limparDados(chatId);
                await engine.avancarEstado(chatId, proximo, corpo);
                const configProximo = await estadoRepository.obterConfigEstado(proximo);
                if (configProximo && typeof this[configProximo.handler] === 'function') {
                    await this[configProximo.handler](message, chatId, '', engine);
                }
                return;
            }
        }

        // ── Sem valor, sem body fixo e sem dados na memória ────────────────────────
        // Só volta atrás (pede info ao usuário) se o estado tiver "mensagemPedir".
        // Sem mensagemPedir = o estado é auto-executável (transitou automaticamente).
        if (!corpo && !usandoBodyFixo && !usandoMulti && Object.keys(dadosMemoria).length === 0) {
            if (config.mensagemPedir) {
                await this.enviarResposta(message, config.mensagemPedir);
                return; // ← aguarda o usuário enviar o valor
            }
            // Sem mensagemPedir: continua e executa a requisição com corpo vazio.
        }

        let valorParaTransicao = '*';

        try {
            const metodo = (config.metodo ?? 'GET').toUpperCase();

            // chatId e from ficam disponíveis para interpolação na URL/body
            // Ex: "url": "https://api.exemplo.com/status/{chatId}"
            const from   = message.from ?? chatId;
            const numero = from.split('@')[0];
            const tudo   = { id: gerarUUID(), valor: corpo, chatId, from, numero, ...dadosMemoria };
            const urlBase = engine.interpolar(config.url ?? '', tudo);
            const headers = { 'Content-Type': 'application/json', ...(config.headers ?? {}) };

            let bodyObj;

            if (usandoBodyFixo) {
                // ── Modo 1: body fixo profundo — interpola variáveis no JSON recursivamente ──
                const interpolarDeep = (obj) => {
                    if (typeof obj === 'string') return engine.interpolar(obj, tudo);
                    if (Array.isArray(obj)) return obj.map(item => interpolarDeep(item));
                    if (typeof obj === 'object' && obj !== null) {
                        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, interpolarDeep(v)]));
                    }
                    return obj;
                };
                bodyObj = interpolarDeep(config.body);
                console.log(`[Bot] [${chatId}] _handlerRequisicao body fixo interpolado:`, JSON.stringify(bodyObj));
            } else if (usandoMulti) {
                // ── Modo 2: multi-campo — usa apenas as chaves listadas em camposEnviar ──
                bodyObj = Object.fromEntries(
                    config.camposEnviar.map(chave => [chave, dadosMemoria[chave] ?? ''])
                );
            } else if (config.campoEnviar && typeof config.campoEnviar === 'string') {
                // ── Modo 3: campo simples — campoEnviar DEVE ser string (não boolean) ──
                const valorCampo = dadosMemoria[config.campoEnviar] ?? corpo;
                bodyObj = { [config.campoEnviar]: valorCampo };
            } else {
                // ── Modo 4: fallback — envia o valor bruto digitado pelo usuário ──
                bodyObj = { valor: corpo };
            }

            let resposta;
            let statusHttp;

            if (metodo === 'GET') {
                let urlFinal = urlBase;
                // Para GET, só acrescenta query string se não for body fixo
                // (body fixo em GET não faz sentido; a URL já contém os parâmetros via {valor})
                if (!usandoBodyFixo) {
                    const queryParams = new URLSearchParams(bodyObj).toString();
                    if (queryParams) {
                        const queryChar = urlFinal.includes('?') ? '&' : '?';
                        urlFinal += `${queryChar}${queryParams}`;
                    }
                }
                const modReq = await import('node-fetch');
                const fetch  = modReq.default;
                const res    = await fetch(urlFinal, { headers });
                statusHttp   = res.status;
                resposta     = await res.json();
            } else {
                const modReq = await import('node-fetch');
                const fetch  = modReq.default;
                const res    = await fetch(urlBase, {
                    method:  metodo,
                    headers,
                    body:    JSON.stringify(bodyObj),
                });
                statusHttp = res.status;
                resposta   = await res.json();
            }

            if (statusHttp !== 200) {
                console.error(`[Bot] API Error HTTP ${statusHttp}`, JSON.stringify(resposta));
                await this.enviarResposta(message, config.mensagemErro ?? '❌ Erro ao processar a solicitação.');
            } else {
                const valorExtraido = engine.extrairValorPath(resposta, config.campoResposta);

                if (valorExtraido === '' || valorExtraido === null || valorExtraido === undefined) {
                    await this.enviarResposta(message, config.mensagemNaoEncontrado ?? '🤷‍♂️ Não encontrado.');

                } else if (Array.isArray(valorExtraido)) {
                    // ── Resposta em array: formata cada item com o template e junta ──
                    if (valorExtraido.length === 0) {
                        await this.enviarResposta(message, config.mensagemNaoEncontrado ?? '🤷‍♂️ Não encontrado.');
                    } else {
                        const separador = config.separador ?? '➖➖➖➖➖';
                        const partes = valorExtraido.map((item) => {
                            const objLimpo = Object.fromEntries(
                                Object.entries(item).map(([k, v]) => [
                                    k,
                                    typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').trim() : v
                                ])
                            );
                            const vars = { resposta: item, valor: corpo, ...dadosMemoria, ...objLimpo };
                            return engine.interpolar(config.mensagemSucesso ?? '✅ {resposta}', vars);
                        });
                        await this.enviarResposta(message, partes.join(`\n\n${separador}\n\n`));
                    }

                } else {
                    // ── Resposta única (objeto ou valor primitivo) ──
                    if (typeof valorExtraido !== 'object') {
                        valorParaTransicao = String(valorExtraido).toLowerCase();
                    }

                    let variaveis = { resposta: valorExtraido, valor: corpo, ...dadosMemoria };

                    if (typeof valorExtraido === 'object' && valorExtraido !== null) {
                        const objLimpo = Object.fromEntries(
                            Object.entries(valorExtraido).map(([k, v]) => [
                                k,
                                typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').trim() : v
                            ])
                        );
                        variaveis = { ...variaveis, ...objLimpo };
                    }

                    const msgSucesso = engine.interpolar(
                        config.mensagemSucesso ?? '✅ Resposta: {resposta}',
                        variaveis
                    );
                    await this.enviarResposta(message, msgSucesso);
                }
            }

        } catch (err) {
            console.error(`Erro na requisição:`, err.message);
            await this.enviarResposta(message, config.mensagemErro ?? '❌ Erro ao processar a solicitação.');
        }

        // Limpa dados da memória após a requisição:
        // - body fixo: sempre limpa (os dados foram usados no body)
        // - multi-campo: limpa os campos coletados
        // - campo salvo via _handlerCapturar: limpa se campoSalvar está configurado
        if (config.limparDados !== false && (usandoBodyFixo || usandoMulti || config.campoSalvar)) {
            engine.limparDados(chatId);
        }

        if (config.transicaoAutomatica || config.transicao_automatica) {
            let proximo = await estadoRepository.buscarProximoEstado(estadoAtual, valorParaTransicao);
            
            // Fallback para '*' caso não exista transição específica com o valor retornado
            if (!proximo && valorParaTransicao !== '*') {
                proximo = await estadoRepository.buscarProximoEstado(estadoAtual, '*');
            }

            if (proximo) {
                await engine.avancarEstado(chatId, proximo, corpo);
                const configProximo = await estadoRepository.obterConfigEstado(proximo);
                if (configProximo && typeof this[configProximo.handler] === 'function') {
                    await this[configProximo.handler](message, chatId, '', engine);
                }
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // STEP: _handlerDelay
    //
    // Aguarda um tempo configurado antes de avançar automaticamente.
    // Usado para pausas no fluxo de conversação.
    //
    // config esperado:
    // {
    //   "duracao": 5,                    ← tempo em segundos (padrão: 1)
    //   "unidade": "seconds",            ← seconds|minutes (padrão: seconds)
    //   "mensagem": "Aguarde..."         ← mensagem opcional durante espera
    // }
    // ─────────────────────────────────────────────────────────────────────────

    async _handlerDelay(message, chatId, corpo, engine) {
        const estadoAtual = engine.estadosUsuarios.get(chatId);
        const config      = (await estadoRepository.obterConfigEstado(estadoAtual))?.config ?? {};

        const duracao = config.duracao || 1;
        const unidade = config.unidade || 'seconds';
        const multiplicador = unidade === 'minutes' ? 60000 : 1000;
        const ms = duracao * multiplicador;

        // Mensagem opcional durante a espera
        if (config.mensagem) {
            await this.enviarResposta(message, config.mensagem);
        }

        // Aguarda o tempo configurado (máximo 5 minutos para segurança)
        const tempoReal = Math.min(ms, 300000);
        await new Promise(resolve => setTimeout(resolve, tempoReal));

        // Avança automaticamente via transição '*'
        const proximo = await estadoRepository.buscarProximoEstado(estadoAtual, '*');
        if (proximo) {
            await engine.avancarEstado(chatId, proximo, '[delay]');
            const configProximo = await estadoRepository.obterConfigEstado(proximo);
            if (configProximo && typeof this[configProximo.handler] === 'function') {
                await this[configProximo.handler](message, chatId, '', engine);
            }
        }
    }
}

module.exports = Handler;
