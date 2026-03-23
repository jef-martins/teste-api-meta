import { Controller, Get, Logger, Post, Req, Res, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BotMetaService } from './bot-meta.service';

@Controller('webhook-meta')
export class BotMetaController {
  private readonly logger = new Logger(BotMetaController.name);

  constructor(private readonly metaService: BotMetaService) {}

  /**
   * GET /api/webhook-meta
   * Endpoint de verificação do webhook exigido pela Meta.
   * A Meta envia hub.mode, hub.challenge e hub.verify_token.
   * Se o token bater com VERIFY_TOKEN, devolvemos o challenge.
   */
  @Get()
  verifyWebhook(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'];
    const challenge = req.query['hub.challenge'];
    const token = req.query['hub.verify_token'];
    const verifyToken = process.env.VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('[Webhook] Verificação do webhook pela Meta: SUCESSO');
      res.status(HttpStatus.OK).send(challenge);
    } else {
      this.logger.warn(`[Webhook] Verificação falhou — token recebido: "${token}" | esperado: "${verifyToken}"`);
      res.status(HttpStatus.FORBIDDEN).end();
    }
  }

  /**
   * POST /api/webhook-meta
   * Recebe todos os eventos/mensagens do WhatsApp via Meta Cloud API.
   * Responde 200 imediatamente para a Meta e processa em background.
   */
  @Post()
  async handleIncomingMessage(@Req() req: Request, @Res() res: Response) {
    const body = req.body;

    // A Meta exige resposta 200 em até 20s, respondemos imediatamente
    res.status(HttpStatus.OK).end();

    this.logger.log(`[Webhook] POST recebido — object: ${body?.object ?? 'N/A'}`);

    if (body.object === 'whatsapp_business_account') {
      if (
        body.entry &&
        body.entry[0]?.changes &&
        body.entry[0].changes[0]?.value?.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const value = body.entry[0].changes[0].value;
        const messages = value.messages;

        this.logger.log(`[Webhook] ${messages.length} mensagem(ns) recebida(s) para processar.`);

        for (const message of messages) {
          try {
            await this.metaService.processarMensagem(message, value);
          } catch (error: any) {
            this.logger.error(`[Webhook] Erro ao processar mensagem: ${error.message}`);
          }
        }
      } else {
        this.logger.debug(`[Webhook] Evento recebido sem mensagens (ex: status de entrega). Ignorando.`);
      }
    } else {
      this.logger.warn(`[Webhook] Objeto desconhecido recebido: ${JSON.stringify(body).substring(0, 200)}`);
    }
  }
}
 