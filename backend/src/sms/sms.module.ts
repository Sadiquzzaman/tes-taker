import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsRateLimitService } from './sms-rate-limit.service';
import { SmsController } from './sms.controller';
import { RedisModule } from '../config/redis.module';

@Module({
  imports: [RedisModule],
  providers: [SmsService, SmsRateLimitService],
  controllers: [SmsController],
  exports: [SmsService, SmsRateLimitService],
})
export class SmsModule {} 