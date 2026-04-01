import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ZenviaService } from './zenvia.service';

@Controller('zenvia')
export class ZenviaController {
  constructor(private readonly zenviaService: ZenviaService) {}

  /**
   * Inicia uma execução em memória.
   * Aceita body como array de etapas no formato:
   * [{ ordem, tipo, texto, opcoes_validacao }]
   * ou objeto { executionId, from, to, itens|mensagens, ... }.
   */
  @Post()
  iniciar(
    @Body() body: unknown,
    @Query('executionId') executionId?: string,
    @Query('to') to?: string,
    @Query('from') from?: string,
    @Query('token') token?: string,
    @Query('baseUrl') baseUrl?: string,
    @Query('webhookSecret') webhookSecret?: string,
  ) {
    return this.zenviaService.iniciarFluxo(body, {
      executionId,
      to,
      from,
      token,
      baseUrl,
      webhookSecret,
    });
  }

  /**
   * Endpoint webhook para respostas de usuário vindas da Zenvia.
   * Se ZENVIA_WEBHOOK_SECRET estiver configurado, validar header x-zenvia-secret.
   */
  @Post('webhook')
  webhook(@Body() body: unknown, @Headers() headers: Record<string, string>) {
    return this.zenviaService.processarWebhook(body, headers);
  }

  /**
   * Permite registrar resposta manualmente por request.
   * Útil para integrações externas que já recebem a resposta do usuário.
   */
  @Post(':executionId/resposta')
  responderManual(
    @Param('executionId') executionId: string,
    @Body() body: { resposta?: string; messageId?: string },
  ) {
    return this.zenviaService.registrarResposta(
      executionId,
      body?.resposta || '',
      body?.messageId || null,
    );
  }

  @Get(':executionId')
  obter(@Param('executionId') executionId: string) {
    return this.zenviaService.obterSessao(executionId);
  }
}
