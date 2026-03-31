import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as os from 'os';
import * as path from 'path';
import Piscina from 'piscina';

@Injectable()
export class HashingService implements OnModuleInit, OnModuleDestroy {
  private pool!: Piscina;

  onModuleInit(): void {
    const workerExt = __filename.endsWith('.ts') ? '.ts' : '.js';
    const workerPath = path.resolve(__dirname, `hash.worker${workerExt}`);

    if (!require('fs').existsSync(workerPath)) {
      throw new Error(
        `Hash worker not found at ${workerPath} - check build output`,
      );
    }

    this.pool = new Piscina({
      filename: workerPath,
      maxThreads: os.cpus().length,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.destroy();
    }
  }

  hash(data: string, rounds = 12): Promise<string> {
    return this.pool.run({ action: 'hash', data, rounds });
  }

  compare(data: string, hash: string): Promise<boolean> {
    return this.pool.run({ action: 'compare', data, hash });
  }
}
