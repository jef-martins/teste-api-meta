import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();
  const trustProxyEnv = process.env.TRUST_PROXY;
  const trustProxy =
    trustProxyEnv === undefined
      ? 1
      : Number.isNaN(Number(trustProxyEnv))
        ? trustProxyEnv
        : Number(trustProxyEnv);

  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { erro: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  });

  const apiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: {
      erro: 'Limite de requisições atingido. Tente novamente em 1 minuto.',
    },
    skip: (req) =>
      req.path.startsWith('/webhook-meta') ||
      req.originalUrl.startsWith('/api/webhook-meta'),
  });

  app.set('trust proxy', trustProxy);
  expressApp.set('trust proxy', trustProxy);

  app.enableShutdownHooks();

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  app.use(helmet({ contentSecurityPolicy: false }));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  app.use('/api/auth', authRateLimiter);
  app.use('/api', apiRateLimiter);

  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api', { exclude: ['health'] });

  const frontendPath = path.join(__dirname, '../../telebots-frontend/dist');
  app.useStaticAssets(frontendPath);
  app.useStaticAssets(path.join(__dirname, '../telas'), { prefix: '/telas/' });

  app
    .getHttpAdapter()
    .get('/{*path}', (req: Request, res: Response, next: NextFunction) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/admin') ||
        req.path.startsWith('/telas')
      ) {
        return next();
      }

      res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
        if (err) next();
      });
    });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(
    `[API] Servidor NestJS rodando na porta ${port} -> http://localhost:${port}`,
  );
}

bootstrap().catch((err) => {
  console.error('[API] Erro ao iniciar a aplicação:', err);
  process.exit(1);
});
