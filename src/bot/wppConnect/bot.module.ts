import { Module } from '@nestjs/common';
import { ConversationModule } from '../../conversation/conversation.module';
import { BotService } from './bot.service';

/**
 * Módulo para as funcionalidades específicas do canal WPPConnect (WhatsApp Local).
 * A lógica central da máquina de estados é importada via BotEngineModule de forma global.
 */
@Module({
  imports: [ConversationModule],
  providers: [
    BotService,
  ],
  exports: [BotService],
})
export class BotModule {}
