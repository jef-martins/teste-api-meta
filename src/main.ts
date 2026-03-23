import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

  app.enableShutdownHooks();

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

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

  // Rate limiting em /api — EXCLUI o webhook da Meta para ele nunca ser bloqueado
  app.use('/api', (req: any, res: any, next: any) => {
    if (req.path.startsWith('/webhook-meta')) return next();
    return rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 100,
      message: {
        erro: 'Limite de requisições atingido. Tente novamente em 1 minuto.',
      },
    })(req, res, next);
  });

  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Serve frontend em produção (dist do Vue) e painel legado
  const frontendPath = path.join(__dirname, '../../telebots-frontend/dist');
  app.useStaticAssets(frontendPath);
  app.useStaticAssets(path.join(__dirname, '../telas'), { prefix: '/telas/' });

  // SPA fallback — serve index.html para rotas do Vue Router
  app.getHttpAdapter().get('/{*path}', (req: any, res: any, next: any) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/admin') ||
      req.path.startsWith('/telas')
    ) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'), (err: any) => {
      if (err) next();
    });
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(
    `[API] Servidor NestJS rodando na porta ${port} → http://localhost:${port}`,
  );
}

bootstrap();
