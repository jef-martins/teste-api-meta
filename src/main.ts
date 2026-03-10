import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({ contentSecurityPolicy: false }));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Rate limiting (same as Express backend)
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: { erro: 'Muitas tentativas. Tente novamente em 15 minutos.' },
    }),
  );

  app.use(
    '/api',
    rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 100,
      message: { erro: 'Limite de requisições atingido. Tente novamente em 1 minuto.' },
    }),
  );

  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api', { exclude: ['health'] });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[API] Servidor NestJS rodando na porta ${port} → http://localhost:${port}`);
}

bootstrap();
