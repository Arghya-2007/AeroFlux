import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: any, res: any, next: () => void) {
    const method = req.method.toUpperCase();
    const secret = this.config.getOrThrow<string>('CSRF_SECRET');
    const isSecure = process.env.NODE_ENV !== 'development';

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      // Issue CSRF token on safe methods if not already present
      if (!req.cookies['csrf_token']) {
        const raw = randomBytes(32).toString('hex');
        const sig = createHmac('sha256', secret).update(raw).digest('hex');
        const token = raw + '.' + sig;
        res.cookie('csrf_token', token, {
          httpOnly: false,   // JS must read it to set the header
          sameSite: 'strict',
          secure: isSecure,
          path: '/',
        });
      }
      return next();
    }

    // Validate on mutating methods (POST, PUT, PATCH, DELETE, …)
    const cookieToken: string | undefined = req.cookies['csrf_token'];
    const headerToken: string | undefined = req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('CSRF token missing');
    }

    // Verify header token signature
    const hParts = headerToken.split('.');
    if (hParts.length !== 2) {
      throw new ForbiddenException('CSRF invalid');
    }
    const [hRaw, hSig] = hParts;
    const expectedHSig = createHmac('sha256', secret).update(hRaw).digest('hex');
    if (
      Buffer.from(hSig, 'hex').length !== Buffer.from(expectedHSig, 'hex').length ||
      !timingSafeEqual(Buffer.from(hSig, 'hex'), Buffer.from(expectedHSig, 'hex'))
    ) {
      throw new ForbiddenException('CSRF invalid');
    }

    // Verify cookie token signature independently
    const cParts = cookieToken.split('.');
    if (cParts.length !== 2) {
      throw new ForbiddenException('CSRF cookie invalid');
    }
    const [cRaw, cSig] = cParts;
    const expectedCSig = createHmac('sha256', secret).update(cRaw).digest('hex');
    if (
      Buffer.from(cSig, 'hex').length !== Buffer.from(expectedCSig, 'hex').length ||
      !timingSafeEqual(Buffer.from(cSig, 'hex'), Buffer.from(expectedCSig, 'hex'))
    ) {
      throw new ForbiddenException('CSRF cookie invalid');
    }

    // Double-submit binding: cookie raw value must match header raw value
    const hRawBuf = Buffer.from(hRaw, 'utf8');
    const cRawBuf = Buffer.from(cRaw, 'utf8');
    if (
      hRawBuf.length !== cRawBuf.length ||
      !timingSafeEqual(hRawBuf, cRawBuf)
    ) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    next();
  }
}
