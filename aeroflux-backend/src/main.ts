// Sentry must be imported before everything else
import './instrument';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust the first proxy hop (ELB/NGINX/K8s ingress) so req.ip reflects the real client IP.
  // Critical for IP-based rate limiting, lockout, and impossible-travel detection.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Replaces class-validator
  app.useGlobalPipes(new ZodValidationPipe());

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
