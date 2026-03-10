import { Module } from '@nestjs/common';
import { ConversationModule } from '../conversation/conversation.module';
import { BotService } from './bot.service';
import { StateMachineEngine } from './state-machine.engine';
import { HandlerService } from './handler.service';
import { EstadoRepository } from './estado.repository';

@Module({
  imports: [ConversationModule],
  providers: [BotService, StateMachineEngine, HandlerService, EstadoRepository],
  exports: [BotService],
})
export class BotModule {}
