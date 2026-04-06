import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Módulo Administrativo para gerenciar fluxos, estados e transições.
 * Acesso global ao BotEngineModule que contém os repositórios e serviços de expiração.
 */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
