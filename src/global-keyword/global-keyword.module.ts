import { Global, Module } from '@nestjs/common';
import { GlobalKeywordController } from './global-keyword.controller';
import { GlobalKeywordRepository } from './global-keyword.repository';
import { GlobalKeywordService } from './global-keyword.service';

@Global()
@Module({
  controllers: [GlobalKeywordController],
  providers: [GlobalKeywordRepository, GlobalKeywordService],
  exports: [GlobalKeywordService],
})
export class GlobalKeywordModule {}
