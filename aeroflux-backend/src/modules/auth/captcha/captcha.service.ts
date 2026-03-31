import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(private readonly configService: ConfigService) {}

  async verify(token: string, ip: string): Promise<boolean> {
    try {
      const secret = this.configService.getOrThrow<string>('TURNSTILE_SECRET_KEY');

      const response = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          secret: secret,
          response: token,
          remoteip: ip,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.success === true;
    } catch (error) {
      this.logger.error('CaptchaService: Turnstile request failed', {
        error: error?.message,
        stack: error?.stack,
      });
      throw new ServiceUnavailableException('CAPTCHA verification service unavailable');
    }
  }
}
