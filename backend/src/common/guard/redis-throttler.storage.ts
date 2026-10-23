import { Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from 'src/config/redis.service';

/** The record type is not exported from the package root, so derive it from the public interface. */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const NOT_LIMITED: ThrottlerStorageRecord = { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };

/**
 * Keeps rate-limit counters in Redis, so every backend instance shares them
 * (the default storage is per process). Fixed window per throttler and key:
 * the window starts at the first hit; past the limit the key is blocked for
 * `blockDuration`. If Redis is unavailable, requests are allowed (fail open)
 * so a Redis outage never takes the API down.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `${hitsKey}:blocked`;
    const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));
    const blockSeconds = Math.max(1, Math.ceil((blockDuration || ttl) / 1000));

    try {
      const blockedFor = await this.redis.ttl(blockKey);
      if (blockedFor > 0) {
        return { totalHits: limit + 1, timeToExpire: blockedFor, isBlocked: true, timeToBlockExpire: blockedFor };
      }

      const totalHits = await this.redis.incrWithTtl(hitsKey, ttlSeconds);
      let timeToExpire = await this.redis.ttl(hitsKey);
      if (timeToExpire < 0) {
        // The expiry was never set (e.g. a crash between INCR and EXPIRE): repair it so the key cannot block forever.
        await this.redis.expire(hitsKey, ttlSeconds);
        timeToExpire = ttlSeconds;
      }

      if (totalHits > limit) {
        await this.redis.set(blockKey, '1', blockSeconds);
        return { totalHits, timeToExpire, isBlocked: true, timeToBlockExpire: blockSeconds };
      }

      return { totalHits, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
    } catch (error) {
      this.logger.warn(
        `Rate limiting skipped, Redis unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return NOT_LIMITED;
    }
  }
}
