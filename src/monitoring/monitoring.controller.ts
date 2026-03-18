import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MasterGuard } from '../auth/master.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private monitoringService: MonitoringService) {}

  @Get('sessoes')
  listarSessoes() {
    return this.monitoringService.listarSessoes();
  }

  @Get('sessoes/:chatId')
  detalhesSessao(@Param('chatId') chatId: string) {
    return this.monitoringService.detalhesSessao(chatId);
  }

  @Get('historico/:chatId')
  historico(@Param('chatId') chatId: string) {
    return this.monitoringService.historico(chatId);
  }

  @Get('dashboard')
  dashboard() {
    return this.monitoringService.dashboard();
  }

  @Get('admin/servidor')
  @UseGuards(MasterGuard)
  infoServidor() {
    return this.monitoringService.infoServidor();
  }

  @Get('admin/servidor/historico')
  @UseGuards(MasterGuard)
  historicoServidor() {
    return this.monitoringService.historicoServidor();
  }
}
