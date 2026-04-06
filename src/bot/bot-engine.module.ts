import { Module, Global } from '@nestjs/common';
import { EstadoRepository } from './estado.repository';
import { DefaultEstadoRepository } from './default-estado.repository';
import { HandlerService } from './handler.service';
import { StateMachineEngine } from './state-machine.engine';
import { IdleExpirationService } from './idle-expiration.service';
import { HandlerZenviaService } from './zenvia/handler-zenvia.service';

/**
 * Verifica se o bot deve operar no modo de memória padrão (in-memory)
 * ou modo persistente (banco de dados/Prisma).
 */
const isDefaultMode = process.env.BOT_STATE_MACHINE_PADRAO === 'true';

/**
 * Provider condicional para o repositório de estados.
 */
const estadoRepositoryProvider = isDefaultMode
  ? { provide: EstadoRepository, useClass: DefaultEstadoRepository }
  : EstadoRepository;

/**
 * Módulo Global que centraliza a lógica do motor dos bots.
 * Fornece EstadoRepository, HandlerService, StateMachineEngine e IdleExpirationService.
 * Por ser @Global, está disponível em toda a aplicação sem imports explícitos.
 */
@Global()
@Module({
  providers: [
    estadoRepositoryProvider,
    DefaultEstadoRepository,
    HandlerService,
    HandlerZenviaService,
    StateMachineEngine,
    IdleExpirationService,
  ],
  exports: [
    EstadoRepository,
    HandlerService,
    HandlerZenviaService,
    StateMachineEngine,
    IdleExpirationService,
  ],
})
export class BotEngineModule {}
