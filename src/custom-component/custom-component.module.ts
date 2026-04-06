import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { FlowModule } from '../flow/flow.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { CustomComponentController } from './custom-component.controller';
import { CustomComponentService } from './custom-component.service';

@Module({
  imports: [PrismaModule, OrganizationModule, FlowModule, CollaborationModule],
  controllers: [CustomComponentController],
  providers: [CustomComponentService],
})
export class CustomComponentModule {}
