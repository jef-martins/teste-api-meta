import { Controller, Get, Post, Req, Res, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BotMetaService } from './bot-meta.service';

@Controller('webhook-meta')
export class BotMetaController {
  constructor(private readonly metaService: BotMetaService) {}

  @Get()
  verifyWebhook(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'];
    const challenge = req.query['hub.challenge'];
    const token = req.query['hub.verify_token'];
    const verifyToken = process.env.VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('WEBHOOK VERIFIED');
      res.status(HttpStatus.OK).send(challenge);
    } else {
      res.status(HttpStatus.FORBIDDEN).end();
    }
  }

  @Post()
  async handleIncomingMessage(@Req() req: Request, @Res() res: Response) {
    const body = req.body;

    // Responde 200 à Meta imediatamente
    res.status(HttpStatus.OK).end();

    if (body.object === 'whatsapp_business_account') {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const value = body.entry[0].changes[0].value;
        const messages = value.messages;
        
        for (const message of messages) {
          try {
            await this.metaService.processarMensagem(message, value);
          } catch (error: any) {
            console.error('Erro ao processar a mensagem da Meta:', error.message);
          }
        }
      }
    }
  }
}
