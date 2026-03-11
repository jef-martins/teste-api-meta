import { Module } from '@nestjs/common';
import { BotMetaController } from './bot-meta.controller';
import { BotMetaService } from './bot-meta.service';
import { HandlerMetaService } from './handler-meta.service';
import { BotModule } from '../wppConnect/bot.module';
import { ConversationModule } from '../../conversation/conversation.module';

@Module({
  imports: [BotModule, ConversationModule],
  controllers: [BotMetaController],
  providers: [BotMetaService, HandlerMetaService],
})
export class BotMetaModule {}
