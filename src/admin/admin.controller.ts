import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

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
  criarEstado(@Body() body: any) {
    return this.adminService.criarEstado(body);
  }

  @Put('estados/:estado')
  atualizarEstado(@Param('estado') estado: string, @Body() body: any) {
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
  criarTransicao(@Body() body: any) {
    return this.adminService.criarTransicao(body);
  }

  @Put('transicoes/:id')
  atualizarTransicao(@Param('id') id: string, @Body() body: any) {
    return this.adminService.atualizarTransicao(id, body);
  }

  @Delete('transicoes/:id')
  excluirTransicao(@Param('id') id: string) {
    return this.adminService.excluirTransicao(id);
  }

  // ─── Teste de Requisição ─────────────────────────────────────────────────

  @Post('testar-req')
  testarRequisicao(@Body() body: any) {
    return this.adminService.testarRequisicao(body);
  }
}
