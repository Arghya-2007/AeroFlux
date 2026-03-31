import { Strategy, ExtractJwt } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../../shared/redis/redis.service';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FATAL: Environment variable ${key} is missing or empty.`);
  }
  return value;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private redis: RedisService) {
    const accessSecret = requireEnv('JWT_ACCESS_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    if (payload?.tokenType && payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const token: string | null = req?.cookies?.access_token || null;

    if (!token) {
      throw new UnauthorizedException('No access token in cookie');
    }

    if (payload?.jti) {
      let isBlacklisted: string | null = null;
      try {
        isBlacklisted = await this.redis.get(`bl_token:${payload.jti}`);
      } catch (err: any) {
        throw new UnauthorizedException('Token validation failed');
      }

      if (isBlacklisted) {
        throw new UnauthorizedException('Token revoked');
      }
    }

    return {
      sub: payload.sub,
      id: payload.sub,
      email: payload.email,
      agencyId: payload.agencyId || null,
      role: payload.role,
      userType: payload.userType || 'Agent',
      jti: payload.jti,
      tokenFamily: payload.tokenFamily,
      exp: payload.exp,
    };
  }
}
