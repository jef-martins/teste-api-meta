import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
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
   * ou objeto { nps_id, from, to, itens|mensagens, ... }.
   */
  @Post()
  iniciar(
    @Body() body: unknown,
    @Query('nps_id') nps_id?: string,
    @Query('to') to?: string,
    @Query('from') from?: string,
    @Query('token') token?: string,
    @Query('baseUrl') baseUrl?: string,
    @Query('webhookSecret') webhookSecret?: string,
  ) {
    return this.zenviaService.iniciarFluxo(body, {
      nps_id,
      to,
      from,
      token,
      baseUrl,
      webhookSecret,
    });
  }

  /**
   * Lista todas as sessões NPS ativas (para o painel admin).
   */
  @Get('sessoes')
  listarSessoes() {
    return this.zenviaService.listarSessoesAtivas();
  }

  /**
   * Atualiza o tempo de expiração por ociosidade de uma sessão ativa.
   * Body: { tempoExpiracaoMinutos: number | null }
   */
  @Patch(':nps_id/expiracao')
  @HttpCode(200)
  atualizarExpiracao(
    @Param('nps_id') nps_id: string,
    @Body() body: { tempoExpiracaoMinutos: number | null },
  ) {
    return this.zenviaService.atualizarTempoExpiracao(nps_id, body?.tempoExpiracaoMinutos ?? null);
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
  @Post(':nps_id/resposta')
  responderManual(
    @Param('nps_id') nps_id: string,
    @Body() body: { resposta?: string; messageId?: string },
  ) {
    return this.zenviaService.registrarResposta(
      nps_id,
      body?.resposta || '',
      body?.messageId || null,
    );
  }

  @Delete(':nps_id')
  encerrar(@Param('nps_id') nps_id: string) {
    return this.zenviaService.encerrarSessao(nps_id);
  }
}
