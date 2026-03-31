import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthEventService } from './auth-event.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '../jwt/jwt.strategy';
import { JwtRefreshStrategy } from '../jwt/jwt-refresh.strategy';
import { PrismaService } from '../../../shared/prisma/prisma.service'; // Adjust path based on your structure
import { RolesGuard } from '../role/roles.guard';
import { RedisModule } from '../../../shared/redis/redis.module';
import { HashingModule } from '../../../shared/hashing/hashing.module';
import { CaptchaService } from '../captcha/captcha.service';

function requireEnv(keys: string[]): void {
  for (const key of keys) {
    const value = process.env[key];
    if (!value) {
      throw new Error(`FATAL: Environment variable ${key} is missing or empty.`);
    }
  }
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FATAL: Environment variable ${key} is missing or empty.`);
  }
  return value;
}

requireEnv([
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'EMAIL_TOKEN_SECRET',
  'MFA_TOKEN_SECRET',
]);

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = getEnv('JWT_ACCESS_SECRET');

        return {
          secret,
          signOptions: {
            expiresIn: '15m',
          },
        };
      },
    }),
    RedisModule,
    HashingModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthEventService,
    JwtStrategy,
    JwtRefreshStrategy,
    RolesGuard,
    PrismaService,
    CaptchaService,
  ],
  exports: [AuthService, AuthEventService, JwtStrategy, PassportModule],
})
export class AuthModule {}
