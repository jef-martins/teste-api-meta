import { Controller, Get, Post, Req, Res, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BotMetaService } from './bot-meta.service';

@Controller('webhook-meta')
export class BotMetaController {
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
      console.log('[Meta Webhook] VERIFICADO COM SUCESSO');
      res.status(HttpStatus.OK).send(challenge);
    } else {
      console.warn('[Meta Webhook] Verificação falhou — token inválido');
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

    if (body.object === 'whatsapp_business_account') {
      if (
        body.entry &&
        body.entry[0]?.changes &&
        body.entry[0].changes[0]?.value?.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const value = body.entry[0].changes[0].value;
        const messages = value.messages;

        for (const message of messages) {
          try {
            await this.metaService.processarMensagem(message, value);
          } catch (error: any) {
            console.error('[Meta Webhook] Erro ao processar mensagem:', error.message);
          }
        }
      }
    }
  }
}
 