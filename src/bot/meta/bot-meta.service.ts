import { Injectable, Logger } from '@nestjs/common';
import { StateMachineEngine } from '../state-machine.engine';
import { HandlerMetaService } from './handler-meta.service';
import { ConversationService } from '../../conversation/conversation.service';

@Injectable()
export class BotMetaService {
  private readonly logger = new Logger(BotMetaService.name);
  private iniciadoEm = Math.floor(Date.now() / 1000);

  constructor(
    private engine: StateMachineEngine,
    private handler: HandlerMetaService,
    private conversationService: ConversationService,
  ) {}

  async processarMensagem(messageItem: any, value: any) {
    const timestampMsg = parseInt(messageItem.timestamp || '0', 10);
    // Ignore old messages before server startup
    if (timestampMsg > 0 && timestampMsg < this.iniciadoEm) return;

    let nome = null;
    if (value.contacts && value.contacts.length > 0) {
      nome = value.contacts[0].profile?.name || null;
    }

    const from = messageItem.from; 
    const phone_id = value.metadata?.phone_number_id; 

    // Configurando as informações para uso no HandlerMetaService
    this.handler.phone_id = phone_id || null;
    this.handler.access_token = process.env.VERIFY_TOKEN || null; // Ou criar uma nova env META_API_TOKEN

    // Test mode
    if (process.env.BOT_MODO_TESTE === 'true') {
      const numeroAdmin = (process.env.BOT_NUMERO_ADMIN || '').replace(/\D/g, '');
      const isAdmin = from === numeroAdmin;
      if (!isAdmin) return;
    }

    this.logger.log(`Mensagem recebida da Meta [${messageItem.type}] de ${from}`);

    let corpo = '';
    
    if (messageItem.type === 'text') {
      corpo = (messageItem.text?.body || '').trim();
    } else if (messageItem.type === 'interactive') {
      if (messageItem.interactive.type === 'list_reply') {
        corpo = (messageItem.interactive.list_reply?.id || '').trim();
      } else if (messageItem.interactive.type === 'button_reply') {
        corpo = (messageItem.interactive.button_reply?.id || '').trim();
      }
    } else if (messageItem.type === 'button') {
      corpo = (messageItem.button?.payload || '').trim();
    }

    const fromComDominio = `${from}@c.us`; 

    const mockMessage = {
      from: fromComDominio,
      to: `${phone_id}@c.us`, 
      body: corpo, 
      type: messageItem.type === 'text' ? 'chat' : messageItem.type,
      sender: {
        pushname: nome,
        name: nome
      },
      _metaOriginal: messageItem
    };

    try {
      await this.salvarNoBanco(mockMessage, from, phone_id, nome, corpo);
      
      await this.engine.process(
        mockMessage,
        fromComDominio,
        corpo.toLowerCase(), // Bot usa lowerCase para verificar options
        nome,
        this.handler as any 
      );
    } catch (err: any) {
      this.logger.error(`Erro ao processar mensagem MS: ${err.message}`);
    }
  }

  private async salvarNoBanco(message: any, from: string, to: string, nome: string | null, corpo: string) {
    try {
      await this.conversationService.salvarMensagem(
        nome,
        message, 
        from,
        to,
        corpo, 
      );
    } catch (err: any) {
      this.logger.error(`Falha ao salvar mensagem: ${err.message}`);
    }
  }
}
