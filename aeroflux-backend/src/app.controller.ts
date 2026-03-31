import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
