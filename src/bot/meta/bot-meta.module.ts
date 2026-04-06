import { Module } from '@nestjs/common';
import { BotMetaController } from './bot-meta.controller';
import { BotMetaService } from './bot-meta.service';
import { HandlerMetaService } from './handler-meta.service';
import { ConversationModule } from '../../conversation/conversation.module';

/**
 * Módulo para as funcionalidades específicas do canal Meta (WhatsApp Cloud API).
 * A lógica central da máquina de estados é importada via BotEngineModule de forma global.
 */
@Module({
  imports: [ConversationModule],
  controllers: [BotMetaController],
  providers: [
    BotMetaService,
    HandlerMetaService,
  ],
})
export class BotMetaModule {}
