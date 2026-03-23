import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConversationService } from '../../conversation/conversation.service';
import { StateMachineEngine } from '../state-machine.engine';
import { HandlerService } from './handler.service';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private client: any = null;
  private sessao: string;
  private iniciadoEm = 0;

  constructor(
    private engine: StateMachineEngine,
    private handler: HandlerService,
    private conversationService: ConversationService,
  ) {
    this.sessao = process.env.BOT_SESSAO || 'sessao-bot-wpp';
  }

  async onModuleInit() {
    if (process.env.NODE_ENV === 'production') {
      this.logger.log('Desativando WPPConnect no ambiente de produção (usando a Meta API).');
      return;
    }
    this.iniciar().catch((err) => {
      this.logger.error(`Falha ao iniciar o bot: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.close();
        this.logger.log('Navegador do WPPConnect fechado.');
      } catch (err: any) {
        this.logger.error(`Erro ao fechar WPPConnect: ${err.message}`);
      }
    }
  }

  async iniciar() {
    this.iniciadoEm = Math.floor(Date.now() / 1000);
    this.logger.log(`Iniciando sessão WPPConnect: ${this.sessao}`);

    try {
      // Import dinâmico do WPPConnect para economizar memória em produção
      const wppconnect = await import('@wppconnect-team/wppconnect');

      this.client = await wppconnect.create({
        session: this.sessao,
        logQR: true,
        autoClose: 0,
        catchQR: (_base64Qr: string, asciiQR: string) => {
          this.logger.log('Escaneie o QR Code para conectar');
          console.log(asciiQR);
        },
        headless: true,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      } as any);

      // Set client on handler so it can send messages
      this.handler.client = this.client;

      await this.aoConectar();
    } catch (error: any) {
      this.logger.error(`Erro ao iniciar WPPConnect: ${error.message}`);
    }
  }

  private async aoConectar() {
    this.logger.log('Conexão estabelecida! Aguardando sincronização...');
    await this.aguardar(3000);
    await this.enviarMensagemDeInicializacao();
    this.ouvirMensagens();
  }

  private async enviarMensagemDeInicializacao() {
    const numero = process.env.BOT_NUMERO_ADMIN || '5514998089672@c.us';
    const texto = '🚀 Bot online e operante via NestJS + WPPConnect!';

    try {
      await this.client.sendText(
        numero.includes('@') ? numero : `${numero}@c.us`,
        texto,
      );
      this.logger.log('Mensagem de inicialização enviada.');
    } catch (err: any) {
      this.logger.error(
        `Erro ao enviar mensagem de inicialização: ${err.message}`,
      );
    }
  }

  private ouvirMensagens() {
    this.client.onMessage(async (message: any) => {
      if (
        !message ||
        message.isGroupMsg ||
        message.from === 'status@broadcast' ||
        message.id?.remote === 'status@broadcast'
      ) {
        return;
      }
      if (message.fromMe) return;

      const timestampMsg = message.timestamp ?? message.t ?? 0;
      if (timestampMsg > 0 && timestampMsg < this.iniciadoEm) return;

      // Test mode: only respond to admin
      if (process.env.BOT_MODO_TESTE === 'true') {
        const numeroAdmin = (process.env.BOT_NUMERO_ADMIN || '').replace(
          /\D/g,
          '',
        );
        const lidAdmin = (process.env.BOT_LID_ADMIN || '').replace(/\D/g, '');
        const numeroRemetente = (message.from || '')
          .split('@')[0]
          .replace(/\D/g, '');

        const isAdmin =
          numeroRemetente === numeroAdmin ||
          (lidAdmin && numeroRemetente === lidAdmin);
        if (!isAdmin) return;
      }

      this.logger.log(
        `Mensagem de ${message.from} [${message.type}]: ${message.body ?? ''}`,
      );

      try {
        await this.salvarNoBanco(message);
        await this.processarMensagem(message);
      } catch (err: any) {
        this.logger.error(
          `Erro ao processar mensagem de ${message.from}: ${err.message}`,
        );
      }
    });
  }

  private async processarMensagem(message: any) {
    const chatId = message.chatId || message.from;
    const nome = message.sender?.pushname || message.sender?.name || null;

    let corpo = '';
    if (message.type === 'list_response') {
      corpo = (message.selectedRowId || '').trim();
    } else if (message.type === 'buttons_response') {
      corpo = (message.selectedButtonId || '').trim();
    } else {
      corpo = (message.body || message.content || '').trim();
    }

    await this.engine.process(message, chatId, corpo, nome, this.handler);
  }

  private async salvarNoBanco(message: any) {
    const nome = message.sender?.pushname || message.sender?.name || null;
    const quemEnviou = this.extrairNumero(message.from);
    const paraQuem = this.extrairNumero(message.to);

    try {
      await this.conversationService.salvarMensagem(
        nome,
        message,
        quemEnviou,
        paraQuem,
        message.body || message.content || '',
      );
    } catch (err: any) {
      this.logger.error(`Falha ao salvar mensagem: ${err.message}`);
    }
  }

  private extrairNumero(jid: string | undefined): string | null {
    if (!jid) return null;
    return jid.split('@')[0].substring(0, 20);
  }

  private aguardar(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
