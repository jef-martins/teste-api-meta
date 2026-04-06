import {
  Body,
  Controller,
  Delete,
  Get,
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
   * Inicia uma execução em memória ou via Redis (NPS).
   * Aceita body como array de etapas ou objeto estruturado.
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
   * Lista todas as sessões NPS ativas.
   */
  @Get('sessoes')
  listarSessoes() {
    return this.zenviaService.listarSessoesAtivas();
  }

  /**
   * Atualiza o tempo de expiração por ociosidade de uma sessão ativa.
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
   */
  @Post('webhook')
  webhook(@Body() body: unknown) {
    return this.zenviaService.processarWebhook(body);
  }

  @Delete(':nps_id')
  encerrar(@Param('nps_id') nps_id: string) {
    return this.zenviaService.encerrarSessao(nps_id);
  }
}
