import { Module } from '@nestjs/common';
import { RedisProvider } from './redis.provider';
import { RedisService } from './redis.service';
import { RedisAdminController } from './redis-admin.controller';

@Module({
  providers: [...RedisProvider, RedisService],
  controllers: [RedisAdminController],
  exports: [RedisService],
})
export class RedisModule {} 