import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  AdminService,
  EstadoInput,
  EstadoUpdateInput,
  TransicaoInput,
  TransicaoUpdateInput,
  TesteRequisicaoInput,
} from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) { }

  @Get('modo')
  obterModo() {
    return this.adminService.obterModo();
  }

  // ─── Estados ─────────────────────────────────────────────────────────────

  @Get('estados')
  listarEstados() {
    return this.adminService.listarEstados();
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
  listarTransicoes() {
    return this.adminService.listarTransicoes();
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
