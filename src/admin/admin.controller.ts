import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  AdminService,
  EstadoInput,
  EstadoUpdateInput,
  TransicaoInput,
  TransicaoUpdateInput,
  TesteRequisicaoInput,
} from './admin.service';
import { IdleExpirationService } from '../bot/idle-expiration.service';

@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private idleExpiration: IdleExpirationService,
  ) { }

  @Get('modo')
  obterModo() {
    return this.adminService.obterModo();
  }

  // ─── Expiração por Ociosidade (Meta/WPP) ─────────────────────────────────

  @Get('config/expiracao-ociosidade')
  async obterConfiguracaoExpiracao() {
    return this.idleExpiration.obterConfig();
  }

  @Put('config/expiracao-ociosidade')
  async salvarConfiguracaoExpiracao(
    @Body() body: { tempoExpiracaoMinutos: number | null; mensagemExpiracao: string | null },
  ) {
    const tempoMs =
      body.tempoExpiracaoMinutos !== null && body.tempoExpiracaoMinutos > 0
        ? body.tempoExpiracaoMinutos * 60 * 1000
        : null;
    return this.idleExpiration.salvarConfig({
      tempoExpiracaoMs: tempoMs,
      mensagemExpiracao: body.mensagemExpiracao ?? null,
    });
  }

  // ─── Estados ─────────────────────────────────────────────────────────────

  @Get('fluxos')
  listarFluxos() {
    return this.adminService.listarFluxos();
  }

  @Get('fluxos/painel')
  listarFluxosPainel() {
    return this.adminService.listarFluxosPainel();
  }

  @Get('estados')
  listarEstados(@Query('flowId') flowId?: string) {
    return this.adminService.listarEstados(flowId);
  }

  @Post('estados')
  criarEstado(@Body() body: EstadoInput) {
    return this.adminService.criarEstado(body);
  }

  @Put('estados/:estado')
  atualizarEstado(@Param('estado') estado: string, @Body() body: EstadoUpdateInput) {
    return this.adminService.atualizarEstado(estado, body);
  }

  @Delete('estados/:estado')
  excluirEstado(@Param('estado') estado: string) {
    return this.adminService.excluirEstado(estado);
  }

  // ─── Transições ──────────────────────────────────────────────────────────

  @Get('transicoes')
  listarTransicoes(@Query('flowId') flowId?: string) {
    return this.adminService.listarTransicoes(flowId);
  }

  @Post('transicoes')
  criarTransicao(@Body() body: TransicaoInput) {
    return this.adminService.criarTransicao(body);
  }

  @Put('transicoes/:id')
  atualizarTransicao(@Param('id') id: string, @Body() body: TransicaoUpdateInput) {
    return this.adminService.atualizarTransicao(id, body);
  }

  @Delete('transicoes/:id')
  excluirTransicao(@Param('id') id: string) {
    return this.adminService.excluirTransicao(id);
  }

  // ─── Teste de Requisição ─────────────────────────────────────────────────

  @Post('testar-req')
  testarRequisicao(@Body() body: TesteRequisicaoInput) {
    return this.adminService.testarRequisicao(body);
  }
}
