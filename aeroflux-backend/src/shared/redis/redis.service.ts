import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('FATAL: REDIS_URL is not set');
    super(url);

    this.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }

  onModuleInit() {
    // Initialization logic if needed
  }

  onModuleDestroy() {
    this.disconnect();
  }
}
