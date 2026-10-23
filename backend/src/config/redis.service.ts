import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { RedisClient } from './redis.types';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);

  public constructor(
    @Inject('REDIS_CLIENT')
    private readonly client: RedisClient,
  ) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    try {
      // quit() waits for pending commands to finish before closing the socket.
      await this.client.quit();
      this.logger.log(`Redis connection closed gracefully (signal: ${signal ?? 'n/a'})`);
    } catch (error) {
      this.logger.error(`Error closing Redis connection: ${(error as Error).message}`);
    }
  }

  async set(key: string, value: string, expirationSeconds?: number) {
    if (expirationSeconds) {
      await this.client.set(key, value, 'EX', expirationSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  /**
   * Increment a counter and start its expiry on the first hit, so the window
   * runs from the first increment (fixed window). Returns the new count.
   */
  async incrWithTtl(key: string, expirationSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, expirationSeconds);
    }
    return count;
  }

  /** Sets a key's time-to-live in seconds. */
  async expire(key: string, expirationSeconds: number): Promise<void> {
    await this.client.expire(key, expirationSeconds);
  }

  /** Remaining time-to-live in seconds (-2 if the key does not exist, -1 if it has no expiry). */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async ping(): Promise<boolean> {
    const result = await this.client.ping();
    return result === 'PONG';
  }

  async del(key: string) {
    try {
      if (await this.client.exists(key)) {
        const deleted = await this.client.del(key);
        return deleted;
      } else {
        return 0;
      }
    } catch (error) {
      this.logger.error(`Error deleting key ${key}: ${(error as Error).message}`);
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  async delMultiple(keys: string[]) {
    if (keys.length > 0) {
      return await this.client.del(...keys);
    }
    return 0;
  }
} 