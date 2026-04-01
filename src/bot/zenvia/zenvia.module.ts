import { Module } from '@nestjs/common';
import { ZenviaController } from './zenvia.controller';
import { ZenviaService } from './zenvia.service';

@Module({
  controllers: [ZenviaController],
  providers: [ZenviaService],
  exports: [ZenviaService],
})
export class ZenviaModule {}
