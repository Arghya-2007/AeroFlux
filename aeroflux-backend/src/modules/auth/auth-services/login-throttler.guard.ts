import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    // Agency admin login uses agencyAdminEmail while other login DTOs use email.
    // Keep this dual-field lookup so throttling remains per-account across auth flows.
    const email = req.body?.agencyAdminEmail || req.body?.email;

    if (email) {
      return `${ip}:${String(email).toLowerCase()}`;
    }

    return ip;
  }
}
