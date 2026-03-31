import { HashingService } from './hashing.service';

const CONCURRENCY = 24;
const BCRYPT_ROUNDS = 4;
const TEST_TIMEOUT_MS = 30000;

describe('HashingService concurrency', () => {
  let service: HashingService;

  beforeAll(() => {
    service = new HashingService();
    service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('isolates parallel hash requests with matching compare results', async () => {
    const payloads = Array.from({ length: CONCURRENCY }, (_, index) =>
      `password-${index}-${Date.now()}`,
    );

    const hashes = await Promise.all(
      payloads.map((value) => service.hash(value, BCRYPT_ROUNDS)),
    );

    expect(new Set(hashes).size).toBe(payloads.length);

    const comparisons = await Promise.all(
      payloads.map((value, index) => service.compare(value, hashes[index])),
    );

    expect(comparisons.every(Boolean)).toBe(true);
  }, TEST_TIMEOUT_MS);

  it('keeps concurrent compare requests isolated across positive and negative checks', async () => {
    const payloads = Array.from({ length: CONCURRENCY }, (_, index) => `compare-${index}`);
    const hashes = await Promise.all(
      payloads.map((value) => service.hash(value, BCRYPT_ROUNDS)),
    );

    const positive = await Promise.all(
      payloads.map((value, index) => service.compare(value, hashes[index])),
    );

    const negative = await Promise.all(
      payloads.map((value, index) => service.compare(`${value}-wrong`, hashes[index])),
    );

    expect(positive.every(Boolean)).toBe(true);
    expect(negative.every((result) => result === false)).toBe(true);
  }, TEST_TIMEOUT_MS);
});

