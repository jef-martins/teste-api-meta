import { Module } from '@nestjs/common';
import { ZenviaController } from './zenvia.controller';
import { ZenviaService } from './zenvia.service';
import { BotEngineModule } from '../bot-engine.module';

@Module({
  imports: [BotEngineModule],
  controllers: [ZenviaController],
  providers: [ZenviaService],
  exports: [ZenviaService],
})
export class ZenviaModule {}
