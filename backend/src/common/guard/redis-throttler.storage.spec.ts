import { Logger } from '@nestjs/common';
import { InMemoryRedis } from 'src/common/testing/in-memory-redis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

const TTL_MS = 60_000;
const LIMIT = 3;

describe('RedisThrottlerStorage', () => {
  let redis: InMemoryRedis;
  let storage: RedisThrottlerStorage;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T08:00:00Z'));
    redis = new InMemoryRedis();
    storage = new RedisThrottlerStorage(redis as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const hit = (key = 'ip:1.2.3.4', name = 'default', blockMs = TTL_MS) =>
    storage.increment(key, TTL_MS, LIMIT, blockMs, name);

  it('counts hits within the window and blocks once the limit is passed', async () => {
    for (let i = 1; i <= LIMIT; i++) {
      await expect(hit()).resolves.toMatchObject({ totalHits: i, isBlocked: false, timeToExpire: 60 });
    }
    await expect(hit()).resolves.toMatchObject({ isBlocked: true, timeToBlockExpire: 60 });
    // Still blocked on the next request, without counting further.
    await expect(hit()).resolves.toMatchObject({ isBlocked: true });
  });

  it('allows requests again once the block and the window have expired', async () => {
    for (let i = 0; i <= LIMIT; i++) await hit();

    jest.advanceTimersByTime(TTL_MS + 1000);

    await expect(hit()).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('keeps separate counters per throttler name and per key', async () => {
    for (let i = 0; i <= LIMIT; i++) await hit('ip:1.2.3.4', 'default');

    await expect(hit('ip:1.2.3.4', 'auth-ip')).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
    await expect(hit('ip:5.6.7.8', 'default')).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('uses the block duration when it differs from the window', async () => {
    for (let i = 0; i <= LIMIT; i++) await hit(undefined, undefined, 5 * TTL_MS);

    jest.advanceTimersByTime(TTL_MS + 1000);

    await expect(hit(undefined, undefined, 5 * TTL_MS)).resolves.toMatchObject({ isBlocked: true });
  });

  it('repairs a counter that was left without an expiry', async () => {
    await redis.set('throttle:default:ip:1.2.3.4', '1'); // no TTL, as after a crash between INCR and EXPIRE

    await expect(hit()).resolves.toMatchObject({ totalHits: 2, timeToExpire: 60 });
    await expect(redis.ttl('throttle:default:ip:1.2.3.4')).resolves.toBe(60);
  });

  it('allows the request when Redis fails (fail open)', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const broken = { ttl: jest.fn().mockRejectedValue(new Error('connection refused')) };
    const failing = new RedisThrottlerStorage(broken as never);

    await expect(failing.increment('ip:1.2.3.4', TTL_MS, LIMIT, TTL_MS, 'default')).resolves.toEqual({
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });
});
