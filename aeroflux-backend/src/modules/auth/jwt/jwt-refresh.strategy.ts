import { Strategy, ExtractJwt } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { RedisService } from '../../../shared/redis/redis.service';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FATAL: Environment variable ${key} is missing or empty.`);
  }
  return value;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private redis: RedisService) {
    const refreshSecret = requireEnv('JWT_REFRESH_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['refresh_token'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken = req?.cookies?.['refresh_token'] ?? null;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Refresh token must be provided via secure cookie',
      );
    }

    const tokenFamily = payload.tokenFamily;
    if (!tokenFamily) {
      throw new UnauthorizedException('Invalid token format');
    }
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }
    if (payload.tokenType === 'mfa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const storedDataStr = await this.redis.get(`refresh:${tokenFamily}`);
    if (!storedDataStr) {
      // Reuse detected: no token family found in Redis
      await this.revokeAllUserSessions(payload.sub);
      throw new UnauthorizedException(
        'Token reuse detected \u2014 all sessions revoked',
      );
    }

    const storedData = JSON.parse(storedDataStr);
    const incomingHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const incomingBuffer = Buffer.from(incomingHash, 'hex');
    const storedBuffer = Buffer.from(storedData.hashedToken, 'hex');

    if (
      incomingBuffer.length !== storedBuffer.length ||
      !crypto.timingSafeEqual(incomingBuffer, storedBuffer)
    ) {
      // Reuse detected: hash mismatch
      await this.revokeAllUserSessions(payload.sub);
      throw new UnauthorizedException(
        'Token reuse detected \u2014 all sessions revoked',
      );
    }

    return {
      id: payload.sub,
      email: payload.email,
      agencyId: payload.agencyId || null,
      role: payload.role,
      userType: payload.userType || 'Agent',
      refreshToken,
      tokenFamily,
    };
  }

  private async revokeAllUserSessions(userId: string) {
    const families = await this.redis.smembers(`user_sessions:${userId}`);
    if (families && families.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const family of families) {
        pipeline.del(`refresh:${family}`);
      }
      pipeline.del(`user_sessions:${userId}`);
      await pipeline.exec();
    }
  }
}
