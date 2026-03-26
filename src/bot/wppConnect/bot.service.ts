import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConversationService } from '../../conversation/conversation.service';
import { StateMachineEngine } from '../state-machine.engine';
import { HandlerService } from './handler.service';

type WppMessage = {
  isGroupMsg?: boolean;
  from?: string;
  fromMe?: boolean;
  to?: string;
  chatId?: string;
  type?: string;
  body?: string;
  content?: string;
  timestamp?: number;
  t?: number;
  id?: {
    remote?: string;
    [key: string]: unknown;
  };
  sender?: {
    pushname?: string;
    name?: string;
    [key: string]: unknown;
  };
  listResponse?: {
    singleSelectReply?: {
      selectedRowId?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  selectedRowId?: string;
  buttonsResponse?: {
    selectedButtonId?: string;
    [key: string]: unknown;
  };
  templateButtonReplyMessage?: {
    selectedId?: string;
    [key: string]: unknown;
  };
  selectedButtonId?: string;
  [key: string]: unknown;
};

type WppClient = {
  close: () => Promise<unknown>;
  sendText: (destino: string, texto: string) => Promise<unknown>;
  onMessage: (callback: (message: WppMessage) => Promise<void> | void) => void;
};

type WppConnectModule = {
  create: (options: Record<string, unknown>) => Promise<WppClient>;
};

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private client: WppClient | null = null;
  private sessao: string;
  private iniciadoEm = 0;

  constructor(
    private engine: StateMachineEngine,
    private handler: HandlerService,
    private conversationService: ConversationService,
  ) {
    this.sessao = process.env.BOT_SESSAO || 'sessao-bot-wpp';
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'production') {
      this.logger.log(
        'Desativando WPPConnect no ambiente de produção (usando a Meta API).',
      );
      return;
    }
    this.iniciar().catch((err: unknown) => {
      this.logger.error(`Falha ao iniciar o bot: ${this.getErrorMessage(err)}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.close();
        this.logger.log('Navegador do WPPConnect fechado.');
      } catch (err: unknown) {
        this.logger.error(
          `Erro ao fechar WPPConnect: ${this.getErrorMessage(err)}`,
        );
      }
    }
  }

  async iniciar() {
    this.iniciadoEm = Math.floor(Date.now() / 1000);
    this.logger.log(`Iniciando sessão WPPConnect: ${this.sessao}`);

    try {
      // Import dinâmico do WPPConnect para economizar memória em produção
      const wppconnect =
        (await import('@wppconnect-team/wppconnect')) as unknown as WppConnectModule;

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
      });

      // Set client on handler so it can send messages
      this.handler.client = this.client;

      await this.aoConectar();
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao iniciar WPPConnect: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async aoConectar() {
    this.logger.log('Conexão estabelecida! Aguardando sincronização...');
    await this.aguardar(3000);
    await this.enviarMensagemDeInicializacao();
    this.ouvirMensagens();
  }

  private async enviarMensagemDeInicializacao() {
    if (!this.client) return;

    const numero = process.env.BOT_NUMERO_ADMIN || '5514998089672@c.us';
    const texto = '🚀 Bot online e operante via NestJS + WPPConnect!';

    try {
      await this.client.sendText(
        numero.includes('@') ? numero : `${numero}@c.us`,
        texto,
      );
      this.logger.log('Mensagem de inicialização enviada.');
    } catch (err: unknown) {
      this.logger.error(
        `Erro ao enviar mensagem de inicialização: ${this.getErrorMessage(err)}`,
      );
    }
  }

  private ouvirMensagens() {
    if (!this.client) return;

    this.client.onMessage(async (message: WppMessage) => {
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

        console.log(isAdmin ? 'true' : 'false');
        if (!isAdmin) return;
      }

      this.logger.log(
        `Mensagem de ${message.from ?? 'desconhecido'} [${message.type ?? 'unknown'}]: ${message.body ?? ''}`,
      );

      try {
        await this.salvarNoBanco(message);
        await this.processarMensagem(message);
      } catch (err: unknown) {
        this.logger.error(
          `Erro ao processar mensagem de ${message.from ?? 'desconhecido'}: ${this.getErrorMessage(err)}`,
        );
      }
    });
  }

  private async processarMensagem(message: WppMessage) {
    const chatId = message.chatId || message.from || '';
    const nome = message.sender?.pushname || message.sender?.name || null;

    let corpo = '';
    if (message.type === 'list_response') {
      corpo = (
        message.listResponse?.singleSelectReply?.selectedRowId ||
        message.selectedRowId ||
        message.body ||
        message.content ||
        ''
      )
        .trim()
        .toLowerCase();
    } else if (
      message.type === 'buttons_response' ||
      message.type === 'template_button_reply'
    ) {
      corpo = (
        message.buttonsResponse?.selectedButtonId ||
        message.templateButtonReplyMessage?.selectedId ||
        message.selectedButtonId ||
        message.body ||
        message.content ||
        ''
      )
        .trim()
        .toLowerCase();
    } else {
      corpo = (message.body || message.content || '').trim();
    }

    await this.engine.process(message, chatId, corpo, nome, this.handler);
  }

  private async salvarNoBanco(message: WppMessage) {
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
    } catch (err: unknown) {
      this.logger.error(
        `Falha ao salvar mensagem: ${this.getErrorMessage(err)}`,
      );
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
