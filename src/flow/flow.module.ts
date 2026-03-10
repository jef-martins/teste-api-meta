import { Module } from '@nestjs/common';
import { FlowController } from './flow.controller';
import { FlowService } from './flow.service';
import { FlowConverterService } from './flow-converter.service';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [OrganizationModule],
  controllers: [FlowController],
  providers: [FlowService, FlowConverterService],
  exports: [FlowService, FlowConverterService],
})
export class FlowModule {}
