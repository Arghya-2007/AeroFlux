import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './shared/prisma/prisma.service';
import { AuthModule } from './modules/auth/auth-services/auth.module';
import { RedisModule } from './shared/redis/redis.module';
import { RedisService } from './shared/redis/redis.service';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
// Import your other modules here as you build them

@Module({
  imports: [
    // Sentry must be registered before all other modules to capture errors globally
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        SENTRY_DSN: Joi.string().uri().optional(),
        RESEND_API_KEY: Joi.string().min(10).required(),
        EMAIL_TOKEN_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        MFA_TOKEN_SECRET: Joi.string().min(32).required(),
        TURNSTILE_SECRET_KEY: Joi.string().min(10).required(),
        IP_HMAC_SECRET: Joi.string().min(32).required(),
        REDIS_URL: Joi.string().uri().required(),
        FRONTEND_URL: Joi.string().uri().required(),
        TOTP_ENCRYPTION_KEY: Joi.string().length(64).required(),
      }).unknown(true),
    }),
    // Rate Limiting: Maximum 100 requests per IP every 60 seconds (60000ms)
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => [
        {
          ttl: 60000,
          limit: 100,
          storage: new ThrottlerStorageRedisService(redisService),
        },
      ],
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      // SentryGlobalFilter captures all unhandled exceptions and reports them to Sentry
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Applies rate limiting to all routes globally
    },
  ],
})
export class AppModule {}
