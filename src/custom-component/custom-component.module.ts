import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomComponentController } from './custom-component.controller';
import { CustomComponentService } from './custom-component.service';

@Module({
  imports: [PrismaModule, OrganizationModule],
  controllers: [CustomComponentController],
  providers: [CustomComponentService],
})
export class CustomComponentModule {}
