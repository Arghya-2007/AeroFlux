/**
 * auth-load.ts — Load test for the auth flow (Jest-compatible)
 *
 * Exercises: register → verify-email (mocked) → login → refresh → logout
 * with 50 concurrent virtual users and asserts:
 *   • p95 response time < 500 ms
 *   • zero 5xx errors during the run
 *
 * Run:
 *   RUN_LOAD_TEST=true npx jest auth-load --testTimeout=120000
 *   (or use the package.json script: npm run test:load)
 */

import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { PassportModule } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import * as http from 'http';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { AuthController } from '../auth-services/auth.controller';
import { AuthEventService } from '../auth-services/auth-event.service';
import { AuthService } from '../auth-services/auth.service';
import { LoginThrottlerGuard } from '../auth-services/login-throttler.guard';
import { JwtStrategy } from '../jwt/jwt.strategy';
import { JwtRefreshStrategy } from '../jwt/jwt-refresh.strategy';
import { CaptchaService } from '../captcha/captcha.service';
import { HashingService } from '../../../shared/hashing/hashing.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { RedisService } from '../../../shared/redis/redis.service';

// ---------------------------------------------------------------------------
// In-memory Redis (same lightweight shim used by the abuse tests)
// ---------------------------------------------------------------------------
class InMemoryRedisBatch {
  private ops: Array<() => Promise<unknown>> = [];
  constructor(private r: InMemoryRedis) {}
  set(k: string, v: string, m?: string, t?: number) { this.ops.push(() => this.r.set(k, v, m, t)); return this; }
  get(k: string) { this.ops.push(() => this.r.get(k)); return this; }
  incr(k: string) { this.ops.push(() => this.r.incr(k)); return this; }
  expire(k: string, t: number) { this.ops.push(() => this.r.expire(k, t)); return this; }
  del(k: string) { this.ops.push(() => this.r.del(k)); return this; }
  sadd(k: string, m: string) { this.ops.push(() => this.r.sadd(k, m)); return this; }
  srem(k: string, m: string) { this.ops.push(() => this.r.srem(k, m)); return this; }
  async exec() { const out: Array<[null, unknown]> = []; for (const o of this.ops) { out.push([null, await o()]); } return out; }
}

class InMemoryRedis {
  private store = new Map<string, string>();
  private sets = new Map<string, Set<string>>();
  private exp = new Map<string, number>();

  private purge(k: string) { const e = this.exp.get(k); if (e && e <= Date.now()) { this.store.delete(k); this.sets.delete(k); this.exp.delete(k); } }
  async get(k: string) { this.purge(k); return this.store.get(k) ?? null; }
  async set(k: string, v: string, m?: string, t?: number) { this.store.set(k, v); if (m === 'EX' && t) this.exp.set(k, Date.now() + t * 1000); return 'OK' as const; }
  async incr(k: string) { const c = await this.get(k); const n = parseInt(c ?? '0', 10) + 1; this.store.set(k, String(n)); return n; }
  async expire(k: string, t: number) { this.purge(k); if (!this.store.has(k) && !this.sets.has(k)) return 0; this.exp.set(k, Date.now() + t * 1000); return 1; }
  async del(...ks: string[]) { let d = 0; for (const k of ks) { this.purge(k); if (this.store.delete(k)) d++; if (this.sets.delete(k)) d++; this.exp.delete(k); } return d; }
  async sadd(k: string, ...ms: string[]) { this.purge(k); const s = this.sets.get(k) ?? new Set(); const b = s.size; for (const m of ms) s.add(m); this.sets.set(k, s); return s.size - b; }
  async srem(k: string, ...ms: string[]) { this.purge(k); const s = this.sets.get(k); if (!s) return 0; let r = 0; for (const m of ms) if (s.delete(m)) r++; if (!s.size) this.sets.delete(k); return r; }
  async smembers(k: string) { this.purge(k); const s = this.sets.get(k); return s ? [...s] : []; }
  multi() { return new InMemoryRedisBatch(this); }
  pipeline() { return new InMemoryRedisBatch(this); }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple HTTP request helper that returns status + body + latency. */
function httpRequest(
  baseUrl: string,
  method: string,
  path: string,
  body?: object,
  cookies?: string[],
): Promise<{ status: number; body: any; cookies: string[]; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const data = body ? JSON.stringify(body) : undefined;

    const start = performance.now();
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookies?.length ? { Cookie: cookies.join('; ') } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const latencyMs = performance.now() - start;
          const raw = Buffer.concat(chunks).toString();
          let parsed: any;
          try { parsed = JSON.parse(raw); } catch { parsed = raw; }

          // Extract Set-Cookie headers
          const setCookies = (res.headers['set-cookie'] ?? []).map((c: string) =>
            c.split(';')[0],
          );

          resolve({ status: res.statusCode ?? 0, body: parsed, cookies: setCookies, latencyMs });
        });
      },
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// Jest-compatible test wrapper
// ---------------------------------------------------------------------------
const runLoadTest = process.env.RUN_LOAD_TEST === 'true';

const conditionalIt = runLoadTest ? it : it.skip;

describe('Auth load test', () => {
  conditionalIt('should handle 50 concurrent users under p95 < 500ms with zero 5xx', async () => {
    // ----- Environment -----
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
    process.env.IP_HMAC_SECRET ??= '12345678901234567890123456789012';
    process.env.EMAIL_TOKEN_SECRET ??= 'test-email-secret';

    const redis = new InMemoryRedis();

    // Track registered agents in-memory (simulates DB)
    const agentsByEmail = new Map<string, any>();
    const agentsById = new Map<string, any>();
    let autoId = 0;

    const prismaMock: any = {
      agency: { findUnique: async () => null, update: async () => null, create: async () => null },
      agencyAgent: { findUnique: async () => null, update: async () => null },
      agent: {
        findUnique: async ({ where, select }: any) => {
          const found =
            (where?.email ? agentsByEmail.get(String(where.email).toLowerCase()) : null) ??
            (where?.id ? agentsById.get(where.id) : null);
          if (!found) return null;
          if (!select) return { ...found };
          const sel: any = {};
          for (const [k, v] of Object.entries(select)) { if (v) sel[k] = found[k]; }
          return sel;
        },
        create: async ({ data }: any) => {
          const id = `agent-load-${++autoId}`;
          const record = { id, ...data, isActive: true, isEmailVerified: false, isMfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: [] };
          agentsByEmail.set(record.email.toLowerCase(), record);
          agentsById.set(id, record);
          return { ...record };
        },
        update: async ({ where, data }: any) => {
          const existing = agentsById.get(where.id);
          if (!existing) return null;
          const updated = { ...existing, ...data };
          agentsById.set(updated.id, updated);
          agentsByEmail.set(updated.email.toLowerCase(), updated);
          return { ...updated };
        },
      },
      authEvent: { create: async () => undefined },
    };

    const hashingService = {
      hash: (v: string, r = 4) => bcrypt.hash(v, r),
      compare: (p: string, h: string) => bcrypt.compare(p, h),
    };

    // ----- Build NestJS app -----
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET, signOptions: { expiresIn: '15m' } }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10_000 }]), // high limit for load test
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        LoginThrottlerGuard,
        JwtStrategy,
        JwtRefreshStrategy,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redis },
        { provide: HashingService, useValue: hashingService },
        { provide: CaptchaService, useValue: { verify: async () => true } },
        { provide: AuthEventService, useValue: { logEvent: async () => undefined } },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => {
              const m: Record<string, string> = {
                JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
                JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
                IP_HMAC_SECRET: process.env.IP_HMAC_SECRET!,
                EMAIL_TOKEN_SECRET: process.env.EMAIL_TOKEN_SECRET!,
                RESEND_API_KEY: 're_test_fake',
                MFA_TOKEN_SECRET: 'load-test-mfa-secret-min-32-chars-xx',
                TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
              };
              return m[k];
            },
            getOrThrow: (k: string) => {
              const m: Record<string, string> = {
                JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
                JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
                IP_HMAC_SECRET: process.env.IP_HMAC_SECRET!,
                EMAIL_TOKEN_SECRET: process.env.EMAIL_TOKEN_SECRET!,
                RESEND_API_KEY: 're_test_fake',
                MFA_TOKEN_SECRET: 'load-test-mfa-secret-min-32-chars-xx',
                TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
              };
              if (!(k in m)) throw new Error(`Missing: ${k}`);
              return m[k];
            },
          },
        },
      ],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    await app.listen(0); // random available port

    const server = app.getHttpServer() as http.Server;
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    // -----------------------------------------------------------------------
    //  Virtual-user flow
    // -----------------------------------------------------------------------
    const CONCURRENCY = 50;
    const latencies: number[] = [];
    let fiveXxCount = 0;
    let errorCount = 0;

    async function virtualUser(vuId: number) {
      const email = `vu-${vuId}-${Date.now()}@loadtest.local`;
      const password = 'LoadTest@123';
      const vuLatencies: number[] = [];

      try {
        // 1) Register
        const reg = await httpRequest(baseUrl, 'POST', '/auth/agent/register', {
          name: `VU ${vuId}`,
          email,
          password,
        });
        vuLatencies.push(reg.latencyMs);
        if (reg.status >= 500) fiveXxCount++;

        // 2) Verify email (mock — directly set isEmailVerified in the in-memory store)
        const agent = agentsByEmail.get(email.toLowerCase());
        if (agent) {
          agent.isEmailVerified = true;
          agentsById.set(agent.id, agent);
          agentsByEmail.set(email.toLowerCase(), agent);
        }

        // 3) Login
        const login = await httpRequest(baseUrl, 'POST', '/auth/agent/login', {
          email,
          password,
        });
        vuLatencies.push(login.latencyMs);
        if (login.status >= 500) fiveXxCount++;

        // Collect cookies from the login response for subsequent requests
        const cookies = login.cookies;

        // 4) Refresh — the refresh token is in an httpOnly cookie from login
        const refresh = await httpRequest(
          baseUrl,
          'POST',
          '/auth/refresh-token',
          {},
          cookies,
        );
        vuLatencies.push(refresh.latencyMs);
        if (refresh.status >= 500) fiveXxCount++;

        // Merge any new cookies from the refresh response
        const allCookies = [...cookies, ...refresh.cookies];

        // 5) Logout
        const logout = await httpRequest(
          baseUrl,
          'POST',
          '/auth/logout',
          {},
          allCookies,
        );
        vuLatencies.push(logout.latencyMs);
        if (logout.status >= 500) fiveXxCount++;
      } catch (err) {
        errorCount++;
        // eslint-disable-next-line no-console
        console.warn(`  ⚠  VU ${vuId} error:`, (err as Error).message);
      }

      latencies.push(...vuLatencies);
    }

    // -----------------------------------------------------------------------
    //  Run all VUs concurrently
    // -----------------------------------------------------------------------
    const startTime = performance.now();

    await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) => virtualUser(i)),
    );

    const totalMs = performance.now() - startTime;

    // -----------------------------------------------------------------------
    //  Report
    // -----------------------------------------------------------------------
    latencies.sort((a, b) => a - b);

    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);
    const avg = latencies.reduce((s, v) => s + v, 0) / (latencies.length || 1);

    // Log results for CI visibility (Jest captures stdout)
    const report = [
      '═══════════════════════════════════════════════',
      '           AUTH LOAD TEST RESULTS              ',
      '═══════════════════════════════════════════════',
      `  Virtual users :  ${CONCURRENCY}`,
      `  Total time    :  ${totalMs.toFixed(0)} ms`,
      `  Requests      :  ${latencies.length}`,
      `  Avg latency   :  ${avg.toFixed(1)} ms`,
      `  p50 latency   :  ${p50.toFixed(1)} ms`,
      `  p95 latency   :  ${p95.toFixed(1)} ms`,
      `  p99 latency   :  ${p99.toFixed(1)} ms`,
      `  5xx errors    :  ${fiveXxCount}`,
      `  VU errors     :  ${errorCount}`,
      '═══════════════════════════════════════════════',
    ].join('\n');

    // Use process.stdout.write so Jest --verbose still captures it
    process.stdout.write(`\n${report}\n`);

    // -----------------------------------------------------------------------
    //  Cleanup
    // -----------------------------------------------------------------------
    await app.close();

    // -----------------------------------------------------------------------
    //  Assertions (Jest expect — no process.exit)
    // -----------------------------------------------------------------------
    expect(p95).toBeLessThan(500);
    expect(fiveXxCount).toBe(0);
  }, 60_000); // 60s timeout
});

