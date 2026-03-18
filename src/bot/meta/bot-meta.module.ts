import { Module } from '@nestjs/common';
import { BotMetaController } from './bot-meta.controller';
import { BotMetaService } from './bot-meta.service';
import { HandlerMetaService } from './handler-meta.service';
import { StateMachineEngine } from '../state-machine.engine';
import { EstadoRepository } from '../estado.repository';
import { DefaultEstadoRepository } from './default-estado.repository';
import { ConversationModule } from '../../conversation/conversation.module';

/**
 * Módulo da integração com a Meta (WhatsApp Cloud API).
 *
 * Comportamento controlado por variáveis de ambiente:
 *
 *  BOT_STATE_MACHINE_PADRAO=true
 *    → Usa a máquina de estados padrão (default-state-machine.config.ts)
 *      armazenada em memória. Não acessa o banco de dados.
 *      Ideal para testes rápidos sem configuração de fluxo no painel.
 *
 *  BOT_STATE_MACHINE_PADRAO=false (ou ausente)
 *    → Usa o banco de dados (tabelas bot_estado_config/bot_estado_transicao)
 *      como fonte de verdade para os fluxos configurados no painel.
 */ 

const isDefaultMode = process.env.BOT_STATE_MACHINE_PADRAO === 'true';

/**
 * Provider do repositório de estados.
 * Em modo padrão: DefaultEstadoRepository (in-memory, sem banco).
 * Em modo normal: EstadoRepository (Prisma/PostgreSQL).
 */
const estadoRepositoryProvider = isDefaultMode
  ? { provide: EstadoRepository, useClass: DefaultEstadoRepository }
  : EstadoRepository;

@Module({
  imports: [ConversationModule],
  controllers: [BotMetaController],
  providers: [
    BotMetaService,
    HandlerMetaService,
    StateMachineEngine,
    estadoRepositoryProvider,
    // DefaultEstadoRepository sempre registrado para que o NestJS
    // consiga instanciá-lo quando for usado como useClass acima
    DefaultEstadoRepository,
  ],
})
export class BotMetaModule {}
