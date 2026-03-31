import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthEventType, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FATAL: Environment variable ${key} is missing or empty.`);
  }
  return value;
}

@Injectable()
export class AuthEventService {
  private readonly logger = new Logger(AuthEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  private hashIp(ip: string | undefined): string | null {
    if (!ip) return null;
    const secret = requireEnv('IP_HMAC_SECRET');
    return crypto.createHmac('sha256', secret).update(ip).digest('hex');
  }

  async logEvent(params: {
    type: AuthEventType;
    agentId?: string;
    ip?: string;
    userAgent?: string;
    country?: string;
    city?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      await this.prisma.authEvent.create({
        data: {
          type: params.type,
          agentId: params.agentId || null,
          ipHash: this.hashIp(params.ip),
          userAgent: params.userAgent || null,
          country: params.country || null,
          city: params.city || null,
          metadata: params.metadata ? (params.metadata as any) : null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log auth event: ${params.type}`, error);
    }
  }
}
