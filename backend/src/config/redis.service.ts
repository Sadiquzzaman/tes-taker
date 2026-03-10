import { Inject, Injectable } from '@nestjs/common';
import { RedisClient } from './redis.types';

@Injectable()
export class RedisService {
  public constructor(
    @Inject('REDIS_CLIENT')
    private readonly client: RedisClient,
  ) {}

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

  async del(key: string) {
    try {
      if (await this.client.exists(key)) {
        const deleted = await this.client.del(key);
        return deleted;
      } else {
        return 0;
      }
    } catch (error) {
      console.error(`Error deleting key ${key}: ${error.message}`);
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