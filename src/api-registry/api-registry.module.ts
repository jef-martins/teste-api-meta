import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { ApiRegistryController } from './api-registry.controller';
import { ApiRegistryService } from './api-registry.service';

@Module({
  imports: [PrismaModule, OrganizationModule],
  controllers: [ApiRegistryController],
  providers: [ApiRegistryService],
})
export class ApiRegistryModule {}
