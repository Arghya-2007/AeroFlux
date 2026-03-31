import {
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';

import * as speakeasy from 'speakeasy';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from '../auth-services/auth.controller';
import { AuthEventService } from '../auth-services/auth-event.service';
import { AuthService } from '../auth-services/auth.service';
import { LoginThrottlerGuard } from '../auth-services/login-throttler.guard';
import { CaptchaService } from '../captcha/captcha.service';
import { HashingService } from '../../../shared/hashing/hashing.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { RedisService } from '../../../shared/redis/redis.service';

type AgentRecord = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isMfaEnabled?: boolean;
  mfaSecret?: string | null;
  mfaRecoveryCodes?: string[];
};

class InMemoryRedisBatch {
  private operations: Array<() => Promise<unknown>> = [];

  constructor(private readonly redis: InMemoryRedis) {}

  set(key: string, value: string, mode?: string, ttlSeconds?: number): this {
    this.operations.push(() => this.redis.set(key, value, mode, ttlSeconds));
    return this;
  }

  get(key: string): this {
    this.operations.push(() => this.redis.get(key));
    return this;
  }

  incr(key: string): this {
    this.operations.push(() => this.redis.incr(key));
    return this;
  }

  expire(key: string, ttlSeconds: number): this {
    this.operations.push(() => this.redis.expire(key, ttlSeconds));
    return this;
  }

  del(key: string): this {
    this.operations.push(() => this.redis.del(key));
    return this;
  }

  sadd(key: string, member: string): this {
    this.operations.push(() => this.redis.sadd(key, member));
    return this;
  }

  srem(key: string, member: string): this {
    this.operations.push(() => this.redis.srem(key, member));
    return this;
  }

  async exec(): Promise<Array<[null, unknown]>> {
    const results: Array<[null, unknown]> = [];

    for (const operation of this.operations) {
      const value = await operation();
      results.push([null, value]);
    }

    return results;
  }
}

class InMemoryRedis {
  private store = new Map<string, string>();
  private sets = new Map<string, Set<string>>();
  private expiresAt = new Map<string, number>();

  clear(): void {
    this.store.clear();
    this.sets.clear();
    this.expiresAt.clear();
  }

  private purgeIfExpired(key: string): void {
    const expiresAt = this.expiresAt.get(key);
    if (expiresAt && expiresAt <= Date.now()) {
      this.store.delete(key);
      this.sets.delete(key);
      this.expiresAt.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.purgeIfExpired(key);
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    ttlSeconds?: number,
  ): Promise<'OK'> {
    this.store.set(key, value);

    if (mode === 'EX' && typeof ttlSeconds === 'number') {
      this.expiresAt.set(key, Date.now() + ttlSeconds * 1000);
    }

    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const nextValue = Number.parseInt(current ?? '0', 10) + 1;
    this.store.set(key, String(nextValue));
    return nextValue;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    this.purgeIfExpired(key);
    if (!this.store.has(key) && !this.sets.has(key)) {
      return 0;
    }

    this.expiresAt.set(key, Date.now() + ttlSeconds * 1000);
    return 1;
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;

    for (const key of keys) {
      this.purgeIfExpired(key);
      if (this.store.delete(key)) {
        deleted += 1;
      }
      if (this.sets.delete(key)) {
        deleted += 1;
      }
      this.expiresAt.delete(key);
    }

    return deleted;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    this.purgeIfExpired(key);
    const set = this.sets.get(key) ?? new Set<string>();
    const initialSize = set.size;

    for (const member of members) {
      set.add(member);
    }

    this.sets.set(key, set);
    return set.size - initialSize;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    this.purgeIfExpired(key);
    const set = this.sets.get(key);
    if (!set) {
      return 0;
    }

    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed += 1;
      }
    }

    if (set.size === 0) {
      this.sets.delete(key);
    }

    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    this.purgeIfExpired(key);
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  multi(): InMemoryRedisBatch {
    return new InMemoryRedisBatch(this);
  }

  pipeline(): InMemoryRedisBatch {
    return new InMemoryRedisBatch(this);
  }
}

describe('Auth abuse security regression tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let authService: AuthService;
  let hashingService: {
    hash: (value: string, rounds?: number) => Promise<string>;
    compare: (plain: string, hash: string) => Promise<boolean>;
  };
  let jwtService: JwtService;
  let redis: InMemoryRedis;
  let agentsByEmail: Map<string, AgentRecord>;
  let agentsById: Map<string, AgentRecord>;

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
    process.env.IP_HMAC_SECRET = process.env.IP_HMAC_SECRET ?? '12345678901234567890123456789012';
    process.env.EMAIL_TOKEN_SECRET = process.env.EMAIL_TOKEN_SECRET ?? 'test-email-secret';

    redis = new InMemoryRedis();
    agentsByEmail = new Map<string, AgentRecord>();
    agentsById = new Map<string, AgentRecord>();

    const prismaMock = {
      agency: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      agencyAgent: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      agent: {
        findUnique: jest.fn(async ({ where, select }: any) => {
          const foundByEmail = where?.email
            ? agentsByEmail.get(String(where.email).toLowerCase())
            : null;
          const foundById = where?.id ? agentsById.get(where.id) : null;
          const agent = foundByEmail ?? foundById;

          if (!agent) {
            return null;
          }

          if (!select) {
            return { ...agent };
          }

          const selected: Record<string, unknown> = {};
          for (const [key, enabled] of Object.entries(select)) {
            if (enabled) {
              selected[key] = (agent as Record<string, unknown>)[key];
            }
          }
          return selected;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const existing = agentsById.get(where.id);
          if (!existing) {
            return null;
          }

          const updated = {
            ...existing,
            ...data,
          };

          agentsById.set(updated.id, updated);
          agentsByEmail.set(updated.email.toLowerCase(), updated);

          return { ...updated };
        }),
      },
      authEvent: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    hashingService = {
      hash: (value: string, rounds = 4) => bcrypt.hash(value, rounds),
      compare: (plain: string, hash: string) => bcrypt.compare(plain, hash),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: process.env.JWT_ACCESS_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 100,
          },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        LoginThrottlerGuard,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: RedisService,
          useValue: redis,
        },
        {
          provide: HashingService,
          useValue: hashingService,
        },
        {
          provide: CaptchaService,
          useValue: {
            verify: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AuthEventService,
          useValue: {
            logEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret',
                JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret',
                IP_HMAC_SECRET: process.env.IP_HMAC_SECRET ?? '12345678901234567890123456789012',
                EMAIL_TOKEN_SECRET: process.env.EMAIL_TOKEN_SECRET ?? 'test-email-secret',
                RESEND_API_KEY: 're_test_fake',
                MFA_TOKEN_SECRET: 'test-mfa-token-secret-min-32-chars-xx',
                TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
              };
              return map[key];
            }),
            getOrThrow: jest.fn((key: string) => {
              const map: Record<string, string> = {
                JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret',
                JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret',
                IP_HMAC_SECRET: process.env.IP_HMAC_SECRET ?? '12345678901234567890123456789012',
                EMAIL_TOKEN_SECRET: process.env.EMAIL_TOKEN_SECRET ?? 'test-email-secret',
                RESEND_API_KEY: 're_test_fake',
                MFA_TOKEN_SECRET: 'test-mfa-token-secret-min-32-chars-xx',
                TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
              };
              if (!(key in map)) throw new Error(`Missing config key: ${key}`);
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    authService = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    redis.clear();
    agentsByEmail.clear();
    agentsById.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  //  Helper: seed an agent record into the in-memory Prisma store
  // -----------------------------------------------------------------------
  async function seedAgent(
    overrides: Partial<AgentRecord> & { email: string; password: string },
  ): Promise<AgentRecord> {
    const passwordHash = await hashingService.hash(overrides.password, 4);
    const agent: AgentRecord = {
      id:
        overrides.id ??
        `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email: overrides.email,
      passwordHash,
      isActive: overrides.isActive ?? true,
      isEmailVerified: overrides.isEmailVerified ?? true,
      isMfaEnabled: overrides.isMfaEnabled ?? false,
      mfaSecret: overrides.mfaSecret ?? null,
      mfaRecoveryCodes: overrides.mfaRecoveryCodes ?? [],
    };
    agentsByEmail.set(agent.email.toLowerCase(), agent);
    agentsById.set(agent.id, agent);
    return agent;
  }

  it(
    'parallel hashing correctness: 50 concurrent compares keep request/result correlation intact',
    async () => {
      const concurrentHashingService = new HashingService();
      concurrentHashingService.onModuleInit();

      const total = 50;

      try {
        const pairs = await Promise.all(
          Array.from({ length: total }, async (_, index) => {
            const password = `pw-${index}-${Date.now()}`;
            const hash = await concurrentHashingService.hash(password, 4);
            const expected = index % 2 === 0;
            const candidate = expected ? password : `${password}-wrong`;
            return { candidate, hash, expected };
          }),
        );

        const outcomes = await Promise.all(
          pairs.map((pair) => concurrentHashingService.compare(pair.candidate, pair.hash)),
        );

        expect(outcomes).toEqual(pairs.map((pair) => pair.expected));
      } finally {
        await concurrentHashingService.onModuleDestroy();
      }
    },
    90000,
  );

  it('JTI uniqueness: signs 100 tokens and each jti is unique', async () => {
    const tokens = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        (authService as any).signAccessToken({
          sub: `agent-${index}`,
          email: `agent-${index}@example.com`,
          role: 'AGENT',
          userType: 'Agent',
          tokenType: 'access',
          tokenFamily: `family-${index}`,
        }),
      ),
    );

    const jtis = tokens.map((token) => {
      const payload = jwtService.decode(token) as { jti?: string };
      return payload?.jti;
    });

    expect(jtis.every((jti) => typeof jti === 'string' && jti.length > 0)).toBe(true);
    expect(new Set(jtis).size).toBe(100);
  });

  it('CAPTCHA gate: 4th failed login requires CAPTCHA when no captchaToken is provided', async () => {
    const email = 'captcha-gate@example.com';
    await seedAgent({ email, password: 'Correct@123' });

    // First 3 attempts — wrong password, should get 401 "Invalid credentials"
    for (let i = 0; i < 3; i += 1) {
      await expect(
        authService.loginAgent({ email, password: 'Wrong@123' }, '127.0.0.1', 'jest-agent'),
      ).rejects.toThrow(UnauthorizedException);
    }

    // 4th attempt — counter is now >= 3, service demands CAPTCHA
    await expect(
      authService.loginAgent({ email, password: 'Wrong@123' }, '127.0.0.1', 'jest-agent'),
    ).rejects.toThrow('CAPTCHA_REQUIRED');
  });

  it('Redis failure during attempt tracking returns ServiceUnavailableException (503)', async () => {
    const email = 'redis-fail@example.com';
    await seedAgent({ email, password: 'Correct@123' });

    // Make the very first Redis get() call throw to simulate downtime
    jest.spyOn(redis, 'get').mockRejectedValueOnce(new Error('Redis down'));

    await expect(
      authService.loginAgent({ email, password: 'Wrong@123' }, '127.0.0.1', 'jest-agent'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('MFA lockout signal: 6 wrong MFA codes returns 429 (not 401)', async () => {
    const rawMfaSecret = speakeasy.generateSecret({ length: 20 }).base32;

    // Replicate the encryption so the mock data matches what the DB would contain
    const key = Buffer.from('a'.repeat(64), 'hex');  // matches TOTP_ENCRYPTION_KEY mock
    const iv = require('crypto').randomBytes(16);
    const cipher = require('crypto').createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(rawMfaSecret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encryptedSecret =
      iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');

    const agent = await seedAgent({
      id: 'agent-mfa-1',
      email: 'mfa-agent@example.com',
      password: 'Any@1234',
      isMfaEnabled: true,
      mfaSecret: encryptedSecret,
    });

    const mfaToken = jwtService.sign({
      sub: agent.id,
      email: agent.email,
      agencyId: null,
      role: 'AGENT',
      userType: 'Agent',
      mfaRequired: true,
      tokenType: 'mfa_pending',
    });

    let thrownError: unknown;

    for (let i = 0; i < 6; i += 1) {
      try {
        await authService.verifyMfaLogin(
          mfaToken,
          '000000',
          '127.0.0.1',
          'jest-agent',
          false,
        );
      } catch (error) {
        thrownError = error;
      }
    }

    expect(thrownError).toBeDefined();
    expect((thrownError as { getStatus: () => number }).getStatus()).toBe(429);
  });

  it('refresh token replay: second use is rejected and rotated token is revoked', async () => {
    const agent = await seedAgent({
      id: 'agent-refresh-1',
      email: 'refresh-agent@example.com',
      password: 'Any@1234',
    });

    const initialTokens = await (authService as any).generateToken(
      agent.id,
      agent.email,
      null,
      'AGENT',
      'Agent',
    );

    const firstRefresh = await authService.refreshToken(
      initialTokens.refreshToken,
      '127.0.0.1',
      'jest-agent',
    );

    const firstRefreshPayload = await jwtService.verifyAsync(<string>firstRefresh.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });

    await wait(2200);

    await expect(
      authService.refreshToken(initialTokens.refreshToken, '127.0.0.1', 'jest-agent'),
    ).rejects.toThrow(UnauthorizedException);

    const revokedFamily = await redis.get(`refresh:${firstRefreshPayload.tokenFamily}`);
    expect(revokedFamily).toBeNull();
  });

  it('email verification gate: login denied when isEmailVerified is false', async () => {
    const email = 'unverified-agent@example.com';
    const password = 'Verified@123';

    await seedAgent({
      id: 'agent-unverified-1',
      email,
      password,
      isEmailVerified: false,
    });

    await expect(
      authService.loginAgent({ email, password }, '127.0.0.1', 'jest-agent'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      authService.loginAgent({ email, password }, '127.0.0.1', 'jest-agent'),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it('case-insensitive email: mixed-case logins share the same failed-attempt counter', async () => {
    const canonical = 'admin@test.com';
    const password = 'Correct@123';

    await seedAgent({
      id: 'agent-case-1',
      email: canonical,
      password,
    });

    // 3 failed attempts with varying casing — each should increment the SAME counter
    const casings = ['Admin@Test.com', 'ADMIN@TEST.COM', 'aDmIn@tEsT.cOm'];
    for (const variant of casings) {
      try {
        await authService.loginAgent(
          { email: variant, password: 'Wrong@123' },
          '127.0.0.1',
          'jest-agent',
        );
      } catch {
        // expected: bad password
      }
    }

    // 4th attempt (lowercase) must require CAPTCHA because the counter is now >= 3
    await expect(
      authService.loginAgent(
        { email: 'admin@test.com', password: 'Wrong@123' },
        '127.0.0.1',
        'jest-agent',
      ),
    ).rejects.toThrow('CAPTCHA_REQUIRED');
  });
});