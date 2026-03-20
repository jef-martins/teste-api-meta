import { Injectable, Logger } from '@nestjs/common';
import { StateMachineEngine } from '../state-machine.engine';
import { HandlerMetaService } from './handler-meta.service';
import { ConversationService } from '../../conversation/conversation.service';

@Injectable()
export class BotMetaService {
  private readonly logger = new Logger(BotMetaService.name);

  /**
   * Timestamp de início do servidor (em segundos).
   * Mensagens com timestamp anterior a este valor são ignoradas
   * para evitar reprocessamento de mensagens antigas ao reiniciar.
   */
  private iniciadoEm = Math.floor(Date.now() / 1000);

  constructor(
    private engine: StateMachineEngine,
    private handler: HandlerMetaService,
    private conversationService: ConversationService,
  ) {}

  async processarMensagem(messageItem: any, value: any) {
    const timestampMsg = parseInt(messageItem.timestamp || '0', 10);

    // Ignora mensagens antigas (anteriores ao início do servidor)
    if (timestampMsg > 0 && timestampMsg < this.iniciadoEm) {
      this.logger.debug(
        `Mensagem ignorada (anterior ao boot): ts=${timestampMsg}`,
      );
      return;
    }

    // Extrai o nome do contato, se disponível
    let nome: string | null = null;
    if (value.contacts && value.contacts.length > 0) {
      nome = value.contacts[0].profile?.name || null;
    } 

    const from = messageItem.from; // número puro, ex: "5514999999999"
    const phone_id = value.metadata?.phone_number_id;

    // Configura o HandlerMetaService com os dados desta requisição
    this.handler.phone_id = phone_id || null;

    // META_ACCESS_TOKEN é o token Bearer para enviar mensagens.
    // Fallback para VERIFY_TOKEN para compatibilidade com configurações antigas
    // onde o mesmo token era usado para ambos os propósitos (como no jasper.js).
    const accessToken = process.env.META_ACCESS_TOKEN || process.env.VERIFY_TOKEN || null;
    if (!process.env.META_ACCESS_TOKEN) {
      this.logger.warn(
        '[Config] META_ACCESS_TOKEN não definido. Usando VERIFY_TOKEN como fallback. ' +
        'Defina META_ACCESS_TOKEN no Render para clareza.',
      );
    }
    this.handler.access_token = accessToken;


    // Modo de teste: responde apenas ao número do admin
    if (process.env.BOT_MODO_TESTE === 'true') {
      const numeroAdmin = (process.env.BOT_NUMERO_ADMIN || '').replace(/\D/g, '');
      const numeroRemetente = from.replace(/\D/g, '');
      const isAdmin = numeroRemetente === numeroAdmin;
      if (!isAdmin) {
        this.logger.debug(`[Modo Teste] Ignorando mensagem de ${from}`);
        return;
      }
    }

    this.logger.log(`Mensagem recebida via Meta [${messageItem.type}] de ${from}`);

    // Normaliza o corpo da mensagem conforme o tipo
    let corpo = '';
    if (messageItem.type === 'text') {
      corpo = (messageItem.text?.body || '').trim();
    } else if (messageItem.type === 'interactive') {
      if (messageItem.interactive?.type === 'list_reply') {
        corpo = (messageItem.interactive.list_reply?.id || '').trim();
      } else if (messageItem.interactive?.type === 'button_reply') {
        corpo = (messageItem.interactive.button_reply?.id || '').trim();
      }
    } else if (messageItem.type === 'button') {
      corpo = (messageItem.button?.payload || '').trim();
    } else {
      // Tipos não suportados (áudio, imagem, etc.) — ignora silenciosamente
      this.logger.debug(`Tipo de mensagem não tratado: ${messageItem.type}`);
      return;
    }

    // Usa o número puro como chatId para compatibilidade com a state machine.
    // Adicionamos sufixo @meta para diferenciar de sessões WPPConnect no banco.
    const chatId = `${from}@meta`;

    // Objeto de mensagem no formato esperado pelo StateMachineEngine e Handlers
    const mockMessage = {
      from: chatId,
      to: `${phone_id}@meta`,
      body: corpo,
      type: messageItem.type === 'text' ? 'chat' : messageItem.type,
      sender: {
        pushname: nome,
        name: nome,
      },
      _metaOriginal: messageItem,
    };

    try {
      // Persiste a mensagem no banco de dados
      await this.salvarNoBanco(mockMessage, from, phone_id, nome, corpo);

      // Processa a mensagem pela máquina de estados
      await this.engine.process(
        mockMessage,
        chatId,
        corpo.toLowerCase(), // Engine usa lowercase para comparar transições
        nome,
        this.handler as any,
      );
    } catch (err: any) {
      this.logger.error(`Erro ao processar mensagem via Meta: ${err.message}`);
    }
  }

  private async salvarNoBanco(
    message: any,
    from: string,
    to: string,
    nome: string | null,
    corpo: string,
  ) {
    try {
      await this.conversationService.salvarMensagem(nome, message, from, to, corpo);
    } catch (err: any) {
      this.logger.error(`Falha ao salvar mensagem no banco: ${err.message}`);
    }
  }
}
