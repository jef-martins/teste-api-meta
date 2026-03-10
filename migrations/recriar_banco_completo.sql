-- =============================================================================
-- recriar_banco_completo.sql
--
-- ATENÇÃO: ESTE SCRIPT APAGA AS TABELAS E RECIA TUDO DO ZERO!
-- Executa a criação de todas as tabelas (com IDs e relacionamentos)
-- e insere os dados iniciais do bot na ordem correta.
-- =============================================================================

-- 1. Limpa tabelas antigas (CASCADE resolve as dependências de chaves estrangeiras)
DROP TABLE IF EXISTS bot_estado_historico CASCADE;
DROP TABLE IF EXISTS bot_estado_usuario   CASCADE;
DROP TABLE IF EXISTS bot_estado_transicao CASCADE;
DROP TABLE IF EXISTS bot_estado_config    CASCADE;
DROP TABLE IF EXISTS conversa             CASCADE;


-- =============================================================================
-- CRIAÇÃO DAS TABELAS
-- =============================================================================

-- Tabela: conversa (usada pelo ConversaRepository)
CREATE TABLE conversa (
    id          SERIAL       PRIMARY KEY,
    nome        VARCHAR(255),
    dados       JSONB,
    quem_enviou VARCHAR(100),
    para_quem   VARCHAR(100),
    mensagem    TEXT,
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Tabela: bot_estado_config (Configurações dos estados/handlers)
CREATE TABLE bot_estado_config (
    estado      VARCHAR(50)  PRIMARY KEY,          -- chave primária: NOVO, MENU ...
    handler     VARCHAR(100) NOT NULL,             -- método JS
    descricao   TEXT,                              -- descrição
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    config      JSONB        NOT NULL DEFAULT '{}'::JSONB -- JSON com as mensagens/url
);

-- Tabela: bot_estado_transicao (Regras de transição de um estado para outro)
CREATE TABLE bot_estado_transicao (
    id              SERIAL       PRIMARY KEY,
    estado_origem   VARCHAR(50)  NOT NULL REFERENCES bot_estado_config(estado) ON DELETE CASCADE,
    entrada         VARCHAR(100) NOT NULL DEFAULT '*',
    estado_destino  VARCHAR(50)  NOT NULL REFERENCES bot_estado_config(estado) ON DELETE CASCADE,
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (estado_origem, entrada)
);

-- Tabela: bot_estado_usuario (Estado atual de cada usuário do bot)
CREATE TABLE bot_estado_usuario (
    chat_id       VARCHAR(100)  PRIMARY KEY,
    nome          VARCHAR(255),
    estado_atual  VARCHAR(50)   NOT NULL DEFAULT 'NOVO' REFERENCES bot_estado_config(estado),
    contexto      JSONB         NOT NULL DEFAULT '{}'::JSONB,
    criado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Tabela: bot_estado_historico (Histórico das ações de cada usuário)
CREATE TABLE bot_estado_historico (
    id                SERIAL        PRIMARY KEY,
    chat_id           VARCHAR(100)  NOT NULL,
    estado_anterior   VARCHAR(50)   NOT NULL,
    estado_novo       VARCHAR(50)   NOT NULL,
    mensagem_gatilho  TEXT,
    criado_em         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    config            JSONB         NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX idx_historico_chat    ON bot_estado_historico (chat_id);
CREATE INDEX idx_historico_criado  ON bot_estado_historico (criado_em DESC);


-- =============================================================================
-- INSERÇÃO DE DADOS INICIAIS (SEED)
-- =============================================================================

-- ── 1. ESTADOS (bot_estado_config) ──────────────────────────────────────────

INSERT INTO bot_estado_config (estado, handler, descricao, config) VALUES
('NOVO', '_handlerMensagem', 'Ponto de entrada do bot — redireciona para verificação de status', '{
    "mensagens": [],
    "transicaoAutomatica": true
}'),

('SAUDACAO', '_handlerMensagem', 'Boas-vindas iniciais após criar conversa', '{
    "mensagens": ["Olá! Obrigado por entrar em contato com a *Telecontrol*. 😊"],
    "transicaoAutomatica": true
}'),

('AGUARDA_LGPD', '_handlerCapturar', 'Aguardando resposta sim/não da LGPD', '{
    "mensagemPedir": "ℹ️ Ao continuar, você estará ciente de que a conversa ficará gravada e seus dados serão tratados conforme a *Lei nº 13.709/2018 (LGPD)*.\n\nVocê concorda? Responda com *sim* ou *não*.",
    "mensagemInvalida": "⚠️ Não entendi. Por favor, responda apenas *sim* ou *não*."
}'),

('MENU', '_handlerCapturar', 'Menu principal de atendimento', '{
    "mensagemPedir": "🔧 *Como posso te ajudar hoje?*\n\n*1* - Consulta de Protocolo\n*2* - Posto Autorizado mais próximo\n*3* - Consulta de Ordem de Serviço\n*4* - Abrir Protocolo de Atendimento\n*5* - Encerrar\n*6* - Falar com Atendente\n\n_Atendimento_Responda com o número da opção desejada._",
    "mensagemInvalida": "⚠️ Opção inválida. Por favor, responda apenas com um número de 1 a 6."
}'),

('CONSULTA_PROTOCOLO', '_handlerRequisicao', 'Consulta de protocolo', '{
    "url": "http://backend2.telecontrol.com.br/homologation-api-callcenter/callcenter/{valor}?ultima_obs_sac=true",
    "metodo": "GET",
    "headers": {
        "Access-Env": "HOMOLOGATION",
        "Access-Application-Key": "64b37f479af4007c883406f0b535c432e22c888e"
    },
    "campoResposta": "data.0.atributes",
    "mensagemSucesso": "✅ *Protocolo Encontrado!*\n\n*Situação:* {situacao}\n*Abertura:* {data_abertura}\n*Observações:* {ultima_obs_sac}\n\nPesquise novamente ou digite sair para voltar ao menu",
    "mensagemConfirmacao": "Consultando o protocolo *{valor}*. Aguarde um instante...",
    "mensagemErro": "❌ Ops! Ocorreu um erro no servidor ao consultar o protocolo.\nTente novamente mais tarde ou digite *sair* para voltar.",
    "mensagemNaoEncontrado": "🤷‍♂️ Protocolo não encontrado.\nVerifique se o número digitado está correto e tente novamente ou digite *sair* para voltar."
}'),

('CONSULTA_POSTO_PROXIMO', '_handlerRequisicao', 'Consulta o posto mais proximo pelo CEP', '{
    "url": "http://api2.telecontrol.com.br/institucional-dev/postoMaisProximo/cep/{valor}/limit/3",
    "metodo": "GET",
    "headers": {
        "access-env": "HOMOLOGATION",
        "Content-Type": "application/json",
        "Access-Application-Key": "64b37f479af4007c883406f0b535c432e22c888e"
    },
    "mensagemSucesso": "🏢 *{nome}*\n📍 {contato_endereco}, {contato_numero} - {contato_complemento}\n🏘 {contato_bairro} - {contato_cidade}\n📞 {fone}\n📧 {contato_email}\n📌 Cód: {codigo_posto} | 📏 {distance} km\n\nSe desejar consultar outro CEP, informe novamente ou digite *sair* para voltar.",
    "separador": "➖➖➖➖➖➖➖➖➖",
    "mensagemConfirmacao": "🔎 Consultando o CEP *{valor}*... Aguarde um instante.",
    "mensagemErro": "❌ Ops! Ocorreu um erro no servidor ao consultar o CEP.\nTente novamente mais tarde ou digite *sair* para voltar.",
    "mensagemNaoEncontrado": "⚠️ CEP não encontrado.\nVerifique se o número digitado está correto (apenas números ou formato 00000000) e tente novamente ou digite *sair* para voltar."
}'),

('CONSULTA_OS', '_handlerRequisicao', 'Consultar numero de ordem de servico', '{
    "url": "http://backend2.telecontrol.com.br/os/ordem/cpf/{valor}",
    "metodo": "GET",
    "headers": {
        "Access-Env": "PRODUCTION",
        "Content-Type": "application/json",
        "Access-Application-Key": "64b37f479af4007c883406f0b535c432e22c888e"
    },
    "campoResposta": "os.0",
    "mensagemSucesso": "✅ *Ordem de Serviço encontrada!*\n\n📌 *Nº da OS:* {os}\n🏭 *Fabricante:* {nome_fabrica}\n📅 *Abertura:* {data_abertura}\n� *Tipo:* {descricao_tipo_atendimento}\n\n👤 *Consumidor:* {consumidor_nome}\n📍 *Endereço:* {consumidor_endereco}, {consumidor_numero} {consumidor_complemento}\n🏘 *Bairro:* {consumidor_bairro} - {consumidor_cidade}/{consumidor_estado}\n📞 *Telefone:* {consumidor_fone}\n\n📦 *Produto:* {descricao}\n� *Referência:* {referencia}\n🆔 *Série:* {serie}\n\n⚠️ *Defeito Reclamado:* {defeito_reclamado}\n🔍 *Defeito Constatado:* {defeito_constatado}\n🛠 *Solução:* {solucao}\n📊 *Status:* {status_os}\n📅 *Conserto:* {data_conserto}\n⏱ *Dias em aberto:* {dias_aberto}\n\nSe desejar consultar outro CPF, informe novamente ou digite *sair* para voltar.",
    "mensagemConfirmacao": "🔄 Consultando Ordens de Serviço para o CPF *{valor}*...\nAguarde um instante.",
    "mensagemErro": "❌ Ops! Ocorreu um erro ao consultar as ordens de serviço.\nTente novamente mais tarde ou digite *sair* para voltar.",
    "mensagemNaoEncontrado": "⚠️ Nenhuma Ordem de Serviço encontrada para este CPF.\nVerifique o número informado e tente novamente ou digite *sair* para voltar."
}'),

-- Estados transitórios: exibem a mensagem pedindo a info e avançam automaticamente para o estado de consulta
('AGUARDA_PROTOCOLO', '_handlerMensagem', 'Pede o número do protocolo ao usuário', '{
    "mensagens": ["🔍 Certo! Por favor, digite o *número do protocolo* que você deseja consultar:\n*(Ou digite \"sair\" para voltar ao menu)*"],
    "transicaoAutomatica": true
}'),

('AGUARDA_POSTO_PROXIMO', '_handlerMensagem', 'Pede o CEP para consulta de posto', '{
    "mensagens": ["📍 Perfeito! Por favor, digite o *CEP* que você deseja consultar:\n*(Ex: 19900000 ou apenas números)\nOu digite \"sair\" para voltar ao menu.*"],
    "transicaoAutomatica": true
}'),

('AGUARDA_OS', '_handlerMensagem', 'Pede o CPF para consulta de OS', '{
    "mensagens": ["🔎 Informe o *CPF* para consultar as Ordens de Serviço:\n*(Digite apenas números ou digite \"sair\" para voltar ao menu)*"],
    "transicaoAutomatica": true
}'),

('CAPTURA_DADOS_PROTOCOLO', '_handlerCapturar', 'Coleta nome, CPF e e-mail antes de criar protocolo', '{
    "campos": [
        {
            "nome": "nome",
            "mensagemPedir": "📝 Para abrir seu atendimento, preciso de algumas informações.\n\n*1º* - Qual é o seu *nome completo*?\n\n_(Ou digite \"sair\" para voltar ao menu)_"
        },
        {
            "nome": "cpf",
            "mensagemPedir": "👤 Certo! Agora informe o seu *CPF* (apenas números):"
        },
        {
            "nome": "email",
            "mensagemPedir": "📧 Por último, informe o seu *e-mail* para contato:"
        }
    ],
    "mensagemConfirmacao": "🔄 Abrindo chamado para *{nome}*...\nAguarde um instante.",
    "transicaoAutomatica": true
}'),

('CRIAR_PROTOCOLO', '_handlerRequisicao', 'Gravar protocolo a partir das informações coletadas', '{
    "url": "http://backend2.telecontrol.com.br/homologation-api-callcenter/callcenterChatBoot",
    "metodo": "POST",
    "headers": {
        "Access-Env": "HOMOLOGATION",
        "Content-Type": "application/json",
        "Access-Application-Key": "64b37f479af4007c883406f0b535c432e22c888e"
    },
    "body": {
        "acao": "abre",
        "nome": "{nome}",
        "email": "{email}",
        "origem": "Whatsapp",
        "celular": "5514998089672",
        "cpf_cnpj": "{cpf}",
        "providencia": "Atendimento Chatbot",
        "classificacao": "Consumidor via Chatbot",
        "titulo_chamado": "Abertura de Atendimento via Chatbot",
        "descricao_chamado": "Consumidor/Protocolo aberto pelo Whatsapp"
    },
    "campoResposta": "data",
    "mensagemSucesso": "✅ *Chamado nº {id} aberto com sucesso!*\n\n📌 Em breve nossa equipe entrará em contato pelo email *{email}*.\n\nSe precisar de mais alguma coisa, é só avisar 😊",
    "mensagemErro": "❌ Não foi possível abrir o chamado no momento.\nTente novamente mais tarde ou digite *sair* para voltar.",
    "transicaoAutomatica": true
}'),

('ENCERRADO', '_handlerMensagem', 'Conversa encerrada', '{
    "mensagens": ["Essa conversa foi encerrada. Em caso de dúvidas, envie uma nova mensagem."],
    "aguardarEntrada": true,
    "transicaoAutomatica": false
}'),

('INSERE_FILA_CHAT', '_handlerRequisicao', 'Coloca o usuário na fila de atendimento humano', '{
    "url": "https://backend2-00174.telecontrol.com.br/homologation-api-chatboot-proxy/chatboot/insereFilaChat",
    "metodo": "POST",
    "headers": {
        "Access-Env": "HOMOLOGATION",
        "Content-Type": "application/json",
        "Access-Application-Key": "64b37f479af4007c883406f0b535c432e22c888e"
    },
    "body": {
      "session": "{session}",
      "celular": "{visitor_cel}",
      "nome": "{visitor_name}",
      "acao": "insere",
      "tipo_hd": "{tipo_hd}",
      "hd_chamado": "{id_ultimo_chamado}",
      "id_fabrica": "{id_fabrica}"
    },
    "transicaoAutomatica": true,
    "mensagemSucesso": "✅ Você foi inserido na fila de atendimento humano. Aguarde um instante!",
    "mensagemErro": "❌ Ocorreu um erro ao te colocar na fila de atendimento. Tente novamente mais tarde."
}'),

('CONSULTA_STATUS_CHAT', '_handlerRequisicao', 'Consulta status do chat atual (Proxy POST p/ GET)', '{
    "url": "https://backend2-00174.telecontrol.com.br/homologation-api-chatboot-proxy/chatboot/consultaStatusChat?fone={visitor_cel}",
    "metodo": "GET",
    "headers": {
        "Access-Env": "HOMOLOGATION",
        "Content-Type": "application/json",
        "Access-Application-Key": "64b37f479af4007c883406f0b535c432e22c888e"
    },
    "campoResposta": "status",
    "transicaoAutomatica": true,
    "mensagemSucesso": "Status consultado com sucesso.",
    "mensagemErro": "❌ Não foi possível consultar o status da fila."
}'),

('CRIA_CONVERSA', '_handlerRequisicao', 'Recebe os dados integrados e gera o ticket base a partir do front.', '{
    "url": "https://backend2-00174.telecontrol.com.br/homologation-api-chatboot-proxy/chatboot/recebe",
    "metodo": "POST",
    "headers": {
        "Access-Env": "HOMOLOGATION",
        "Content-Type": "application/json",
        "Access-Application-Key": "64b37f479af4007c883406f0b535c432e22c888e"
    },
    "body": {
      "rota": "http://backend2.telecontrol.com.br/api-callcenter/callcenterChatBoot",
      "metodo": "post",
      "fluxo": "whatsapp",
      "sessao": "{sessionId}",
      "parametros": {
        "titulo_chamado": "Produto com problema",
        "descricao_chamado": "Produto: {respostaProduto} - {respostaProblemaProduto}",
        "produto": "",
        "acao": "abre",
        "classificacao": "01",
        "origem": "WhatsappBoot",
        "celular": "{visitor_cel}",
        "nome": "{visitor_name}",
        "session": "{session}"
      }
    },
    "transicaoAutomatica": true,
    "mensagemSucesso": "Conversa criada e chamada inicializada no sistema."
}');


-- ── 2. TRANSIÇÕES (bot_estado_transicao) ──────────────────────────────────

INSERT INTO bot_estado_transicao (estado_origem, entrada, estado_destino) VALUES
-- Verificação de Status Inicial
('NOVO',         '*',          'CONSULTA_STATUS_CHAT'),
('CONSULTA_STATUS_CHAT', 'IN_PROGRESS', 'ENCERRADO'),
('CONSULTA_STATUS_CHAT', 'CLOSED',      'ENCERRADO'),
('CONSULTA_STATUS_CHAT', 'NOT_FOUND',   'CRIA_CONVERSA'),
('CRIA_CONVERSA',       '*',          'SAUDACAO'),
('SAUDACAO',            '*',          'AGUARDA_LGPD'),

-- LGPD
('AGUARDA_LGPD', 'sim',    'MENU'),
('AGUARDA_LGPD', 'nao',    'ENCERRADO'),
('AGUARDA_LGPD', 'não',    'ENCERRADO'),

-- Opções do Menu
('MENU',         '1',      'AGUARDA_PROTOCOLO'),
('MENU',         '2',      'AGUARDA_POSTO_PROXIMO'),
('MENU',         '3',      'AGUARDA_OS'),
('MENU',         '4',      'CAPTURA_DADOS_PROTOCOLO'),
('MENU',         '5',      'ENCERRADO'),
('MENU',         '6',      'INSERE_FILA_CHAT'),

-- Estados transitórios: exibem mensagem e avançam automaticamente para consulta
('AGUARDA_PROTOCOLO',    '*',    'CONSULTA_PROTOCOLO'),
('AGUARDA_PROTOCOLO',    'sair', 'MENU'),
('AGUARDA_POSTO_PROXIMO','*',    'CONSULTA_POSTO_PROXIMO'),
('AGUARDA_POSTO_PROXIMO','sair', 'MENU'),
('AGUARDA_OS',           '*',    'CONSULTA_OS'),
('AGUARDA_OS',           'sair', 'MENU'),

-- Consulta de Protocolo (Loop de repetição ou Saída)
('CONSULTA_PROTOCOLO',      '*',    'CONSULTA_PROTOCOLO'),
('CONSULTA_PROTOCOLO',      'sair', 'MENU'),

-- Consulta de Posto (Loop de repetição ou Saída)
('CONSULTA_POSTO_PROXIMO',  '*',    'CONSULTA_POSTO_PROXIMO'),
('CONSULTA_POSTO_PROXIMO',  'sair', 'MENU'),

-- Consulta de OS (Loop de repetição ou Saída)
('CONSULTA_OS',             '*',    'CONSULTA_OS'),
('CONSULTA_OS',             'sair', 'MENU'),

-- Fluxo de Abertura de Protocolo (Novo)
('CAPTURA_DADOS_PROTOCOLO', '*',    'CRIAR_PROTOCOLO'),
('CAPTURA_DADOS_PROTOCOLO', 'sair', 'MENU'),
('CRIAR_PROTOCOLO',         'sair', 'MENU'),

-- Fluxo de Fila
('INSERE_FILA_CHAT',        '*',    'ENCERRADO'),

-- Estado Final
('ENCERRADO',               '*',    'NOVO');

-- =============================================================================
-- FIM DO SCRIPT
-- =============================================================================
