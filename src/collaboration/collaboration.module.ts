import { Module } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationService } from './collaboration.service';
import { AuthModule } from '../auth/auth.module';
import { FlowModule } from '../flow/flow.module';

@Module({
  imports: [AuthModule, FlowModule],
  providers: [CollaborationGateway, CollaborationService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
