import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FlowModule } from './flow/flow.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { ConversationModule } from './conversation/conversation.module';
import { AdminModule } from './admin/admin.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { BotModule } from './bot/wppConnect/bot.module';
import { OrganizationModule } from './organization/organization.module';
import { ApiRegistryModule } from './api-registry/api-registry.module';
import { HealthController } from './health.controller';
import { BotMetaModule } from './bot/meta/bot-meta.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UserModule,
    FlowModule,
    MonitoringModule,
    ConversationModule,
    AdminModule,
    CollaborationModule,
    BotModule,
    BotMetaModule,
    OrganizationModule,
    ApiRegistryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
