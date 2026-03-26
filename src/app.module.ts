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
import { CustomComponentModule } from './custom-component/custom-component.module';
import { HealthController } from './health.controller';
import { BotMetaModule } from './bot/meta/bot-meta.module';
import { GlobalKeywordModule } from './global-keyword/global-keyword.module';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from './redis/redis.module';

/**
 * Estratégia de canal por ambiente:
 *
 *  NODE_ENV=development  → WPPConnect ativo  | Meta webhook DESATIVADO
 *  NODE_ENV=production   → WPPConnect inativo | Meta webhook ATIVO
 *
 * O BotModule (WPPConnect) já controla seu próprio ciclo de vida
 * em bot.service.ts (onModuleInit), desativando-se em produção.
 * Aqui controlamos quais módulos são registrados no DI container.
 */
const isDevelopment = process.env.NODE_ENV === 'development';

const botChannelModules = isDevelopment
  ? [BotModule] // development: apenas WPPConnect
  : [BotModule, BotMetaModule]; // production: Meta ativo (WPPConnect se desativa internamente)

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    RedisModule,
    PrismaModule,
    AuthModule,
    UserModule,
    FlowModule,
    MonitoringModule,
    ConversationModule,
    AdminModule,
    CollaborationModule,
    OrganizationModule,
    ApiRegistryModule,
    GlobalKeywordModule,
    ...botChannelModules,
    CustomComponentModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
