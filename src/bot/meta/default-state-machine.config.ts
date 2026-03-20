/**
 * Máquina de estados padrão baseada no fluxo do Assistente Virtual Braslar.
 *
 * Fluxo completo:
 *  INICIO → (aceite LGPD via botões)
 *    ├─ lgpd_sim → MENU_PRINCIPAL → (lista interativa)
 *    │    ├─ menu_posto      → AGUARDANDO_CEP      → API postoMaisProximo → MENU_PRINCIPAL
 *    │    ├─ menu_protocolo  → AGUARDANDO_PROTOCOLO → API callcenter       → MENU_PRINCIPAL
 *    │    ├─ menu_os         → AGUARDANDO_OS        → API ordem/os         → MENU_PRINCIPAL
 *    │    └─ menu_encerrar   → ENCERRADO           → (auto) → INICIO
 *    └─ lgpd_nao → LGPD_RECUSADO  (encerra)
 *
 * Ativação: set BOT_STATE_MACHINE_PADRAO=true no .env
 */

export interface EstadoConfigDefault {
  ativo?: boolean;
  handler: string;
  descricao: string;
  config: Record<string, any>;
}

export interface TransicaoDefault {
  id?: string;
  ativo?: boolean;
  entrada: string;
  estadoDestino: string;
}

// ─── Definição dos Estados ────────────────────────────────────────────────────

export const DEFAULT_ESTADOS: Record<string, EstadoConfigDefault> = {

  // 1. Estado inicial — solicita aceite LGPD via botões
  INICIO: {
    handler: '_handlerBotoes',
    descricao: 'Mensagem inicial com aceite LGPD',
    config: {
      titulo:
        'Olá! 👋 Para iniciarmos seu atendimento, você aceita o tratamento dos seus dados conforme a LGPD?',
      botoes: [
        { entrada: 'lgpd_sim', label: 'Sim ✅' },
        { entrada: 'lgpd_nao', label: 'Não ❌' },
      ],
    },
  },

  // 2. Usuário recusou a LGPD — encerra o atendimento
  LGPD_RECUSADO: {
    handler: '_handlerMensagem',
    descricao: 'Usuário recusou o aceite da LGPD',
    config: {
      mensagens: [
        '❌ Entendemos. Para sua segurança e conformidade com a LGPD, não podemos prosseguir sem o seu aceite.\n\n' +
        'Caso mude de ideia, envie qualquer mensagem para reiniciar o atendimento.',
      ],
      transicaoAutomatica: true,
    },
  },

  // 3. Menu principal — lista de serviços disponíveis
  MENU_PRINCIPAL: {
    handler: '_handlerLista',
    descricao: 'Menu principal de serviços',
    config: {
      titulo: 'Como posso ajudar você hoje? Selecione uma das opções abaixo:',
      botaoTexto: 'Ver Opções',
      secaoTitulo: 'Serviços',
      rodape: 'Assistente Virtual Braslar',
      opcoes: [
        {
          entrada: 'menu_posto',
          label: 'Posto Mais Próximo',
          descricao: 'Encontre assistência perto de você',
        },
        {
          entrada: 'menu_protocolo',
          label: 'Consultar Protocolo',
          descricao: 'Status do seu atendimento',
        },
        {
          entrada: 'menu_os',
          label: 'Consultar OS',
          descricao: 'Status da sua Ordem de Serviço',
        },
        {
          entrada: 'menu_encerrar',
          label: 'Encerrar',
          descricao: 'Finalizar atendimento',
        },
      ],
    },
  },

  // 4. Aguardando CEP — captura e consulta posto mais próximo
  AGUARDANDO_CEP: {
    handler: '_handlerRequisicao',
    descricao: 'Consulta posto mais próximo por CEP',
    config: {
      mensagemPedir: 'Por favor, digite o seu *CEP* (somente números):',
      metodo: 'GET',
      // {valor} = texto digitado pelo usuário (CEP)
      url: 'http://api2.telecontrol.com.br/institucional-dev/postoMaisProximo/cep/{valor}/limit/3',
      headers: {
        'Access-Application-Key':
          process.env.TOKEN_BRASLAR || '64b37f479af4007c883406f0b535c432e22c888e',
        'api_env': 'HOMOLOGATION',
        'Content-Type': 'application/json',
      },
      // response é um array direto — extrai o array inteiro
      campoResposta: '',
      // template aplicado a cada item do array de postos
      mensagemSucesso:
        '📍 *{nome}*\n' +
        '🏠 Endereço: {contato_endereco}, {contato_numero}\n' +
        '📞 Tel: {fone}\n' +
        '📏 Distância: {distance} km',
      separador: '➖➖➖➖➖',
      mensagemNaoEncontrado: '❌ Nenhum posto encontrado para este CEP.',
      mensagemErro:
        '⚠️ Erro ao consultar os dados. Verifique se o CEP está correto e tente novamente.',
      transicaoAutomatica: true,
      limparDados: true,
    },
  },

  // 5. Aguardando número do protocolo — captura e consulta callcenter
  AGUARDANDO_PROTOCOLO: {
    handler: '_handlerRequisicao',
    descricao: 'Consulta protocolo de atendimento',
    config: {
      mensagemPedir:
        'Por favor, digite o número do seu *Protocolo*:',
      metodo: 'GET',
      url: 'http://backend2.telecontrol.com.br/homologation-api-callcenter/callcenter/{valor}?ultima_obs_sac=true',
      headers: {
        'Access-Application-Key':
          process.env.TOKEN_BRASLAR || '64b37f479af4007c883406f0b535c432e22c888e',
        'Access-Env': 'HOMOLOGATION',
        'Content-Type': 'application/json',
      },
      // response = { data: [ { atributes: {...} } ] } → extrai o array "data"
      campoResposta: 'data',
      // cada item do array é { atributes: { consumidor_nome, situacao, ... } }
      mensagemSucesso:
        '📄 *Detalhes do Protocolo {valor}:*\n\n' +
        '👤 Consumidor: {atributes.consumidor_nome}\n' +
        '📦 Situação: *{atributes.situacao}*\n' +
        '📅 Abertura: {atributes.data_abertura}\n' +
        '🛠 Origem: {atributes.origem}',
      mensagemNaoEncontrado:
        '❌ Protocolo não encontrado. Verifique o número e tente novamente.',
      mensagemErro:
        '⚠️ Erro ao consultar o protocolo. Verifique o número e tente novamente.',
      transicaoAutomatica: true,
      limparDados: true,
    },
  },

  // 6. Aguardando número da OS — captura e consulta ordem de serviço
  AGUARDANDO_OS: {
    handler: '_handlerRequisicao',
    descricao: 'Consulta Ordem de Serviço',
    config: {
      mensagemPedir:
        'Por favor, digite o número da sua *Ordem de Serviço (OS)*:',
      metodo: 'GET',
      url: 'http://backend2.telecontrol.com.br/os/ordem/os/{valor}',
      headers: {
        'Access-Application-Key':
          process.env.TOKEN_BRASLAR || '64b37f479af4007c883406f0b535c432e22c888e',
        'Access-Env': 'HOMOLOGATION',
        'Content-Type': 'application/json',
      },
      // response = { os: [ { consumidor_nome, descricao, status_os, ... } ] }
      campoResposta: 'os',
      mensagemSucesso:
        '🛠 *Detalhes da OS {valor}:*\n\n' +
        '👤 Cliente: {consumidor_nome}\n' +
        '📦 Produto: {descricao}\n' +
        '📊 Status: *{status_os}*\n' +
        '⚠️ Defeito: {defeito_reclamado}\n' +
        '📅 Abertura: {data_abertura}',
      mensagemNaoEncontrado:
        '❌ Ordem de Serviço não encontrada. Verifique o número e tente novamente.',
      mensagemErro:
        '⚠️ Erro ao consultar a OS. Verifique o número e tente novamente.',
      transicaoAutomatica: true,
      limparDados: true,
    },
  },

  // 7. Atendimento encerrado — despede e retorna ao início
  ENCERRADO: {
    handler: '_handlerMensagem',
    descricao: 'Atendimento encerrado pelo usuário',
    config: {
      mensagens: [
        'Atendimento finalizado. Obrigado por entrar em contato! 👋\n\n' +
        'Envie qualquer mensagem para iniciar um novo atendimento.',
      ],
      transicaoAutomatica: true,
    },
  },
};

// ─── Definição das Transições ─────────────────────────────────────────────────

export const DEFAULT_TRANSICOES: Record<string, TransicaoDefault[]> = {
  INICIO: [
    { entrada: 'lgpd_sim', estadoDestino: 'MENU_PRINCIPAL' },
    { entrada: 'lgpd_nao', estadoDestino: 'LGPD_RECUSADO' },
    // qualquer outra mensagem reinicia o fluxo
    { entrada: '*', estadoDestino: 'INICIO' },
  ],

  LGPD_RECUSADO: [
    // após auto-transição, vai para INICIO para nova tentativa futura
    { entrada: '*', estadoDestino: 'INICIO' },
  ],

  MENU_PRINCIPAL: [
    { entrada: 'menu_posto', estadoDestino: 'AGUARDANDO_CEP' },
    { entrada: 'menu_protocolo', estadoDestino: 'AGUARDANDO_PROTOCOLO' },
    { entrada: 'menu_os', estadoDestino: 'AGUARDANDO_OS' },
    { entrada: 'menu_encerrar', estadoDestino: 'ENCERRADO' },
    // opção inválida → reenvia o menu
    { entrada: '*', estadoDestino: 'MENU_PRINCIPAL' },
  ],

  AGUARDANDO_CEP: [
    // após a consulta ser exibida, volta ao menu
    { entrada: '*', estadoDestino: 'MENU_PRINCIPAL' },
  ],

  AGUARDANDO_PROTOCOLO: [
    { entrada: '*', estadoDestino: 'MENU_PRINCIPAL' },
  ],

  AGUARDANDO_OS: [
    { entrada: '*', estadoDestino: 'MENU_PRINCIPAL' },
  ],

  ENCERRADO: [
    // após despedida, retorna ao início para novo atendimento
    { entrada: '*', estadoDestino: 'INICIO' },
  ],
};
