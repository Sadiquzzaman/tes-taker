import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisModule } from '../config/redis.module';
import { ChatMongoModule } from '../chat-mongo/chat-mongo.module';

@Module({
  imports: [RedisModule, ChatMongoModule],
  controllers: [HealthController],
})
export class HealthModule {}
