import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisClient } from './redis.types';

export const RedisProvider: Provider[] = [
  {
    useFactory: async (configService: ConfigService): Promise<RedisClient> => {
      return new Redis({
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
        password: configService.get<string>('REDIS_PASSWORD'),
        db: configService.get<number>('REDIS_DB', 0),
      });
    },
    inject: [ConfigService],
    provide: 'REDIS_CLIENT',
  },
]; 