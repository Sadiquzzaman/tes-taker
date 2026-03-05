import { Injectable } from '@nestjs/common';
import { RedisService } from '../config/redis.service';

@Injectable()
export class SmsRateLimitService {
  constructor(private readonly redisService: RedisService) {}

  private getSmsAttemptKey(phoneNumber: string): string {
    return `sms_attempts:${phoneNumber}`;
  }

  private getSmsBlockKey(phoneNumber: string): string {
    return `sms_blocked:${phoneNumber}`;
  }

  private getOtpKey(phoneNumber: string): string {
    return `sms_otp:${phoneNumber}`;
  }

  async canSendSms(phoneNumber: string): Promise<{ canSend: boolean; remainingAttempts?: number; blockedUntil?: Date }> {
    try {
      // Check if phone is blocked
      const blockedUntil = await this.redisService.get(this.getSmsBlockKey(phoneNumber));
      if (blockedUntil) {
        const blockedTime = new Date(blockedUntil);
        if (blockedTime > new Date()) {
          return { 
            canSend: false, 
            blockedUntil: blockedTime 
          };
        } else {
          // Block expired, remove it
          await this.redisService.del(this.getSmsBlockKey(phoneNumber));
        }
      }

      // Check attempts
      const attempts = await this.redisService.get(this.getSmsAttemptKey(phoneNumber));
      const attemptCount = attempts ? parseInt(attempts) : 0;

      if (attemptCount >= 3) {
        // Block for 1 hour
        const blockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await this.redisService.set(
          this.getSmsBlockKey(phoneNumber),
          blockUntil.toISOString(),
          3600 // 1 hour in seconds
        );
        
        // Reset attempts
        await this.redisService.del(this.getSmsAttemptKey(phoneNumber));
        
        return { 
          canSend: false, 
          blockedUntil: blockUntil 
        };
      }

      return { 
        canSend: true, 
        remainingAttempts: 3 - attemptCount 
      };
    } catch (error) {
      console.error('Redis error in canSendSms:', error);
      // If Redis fails, allow SMS (fail open)
      return { canSend: true, remainingAttempts: 3 };
    }
  }

  async recordSmsAttempt(phoneNumber: string): Promise<void> {
    try {
      const key = this.getSmsAttemptKey(phoneNumber);
      const attempts = await this.redisService.get(key);
      const attemptCount = attempts ? parseInt(attempts) : 0;
      
      await this.redisService.set(key, (attemptCount + 1).toString(), 3600); // 1 hour TTL
    } catch (error) {
      console.error('Redis error in recordSmsAttempt:', error);
    }
  }

  async storeOtp(phoneNumber: string, otp: string): Promise<void> {
    try {
      const key = this.getOtpKey(phoneNumber);
      await this.redisService.set(key, otp, 300); // 5 minutes TTL
    } catch (error) {
      console.error('Redis error in storeOtp:', error);
    }
  }

  async getOtp(phoneNumber: string): Promise<string | null> {
    try {
      const key = this.getOtpKey(phoneNumber);
      return await this.redisService.get(key);
    } catch (error) {
      console.error('Redis error in getOtp:', error);
      return null;
    }
  }

  async removeOtp(phoneNumber: string): Promise<void> {
    try {
      const key = this.getOtpKey(phoneNumber);
      await this.redisService.del(key);
    } catch (error) {
      console.error('Redis error in removeOtp:', error);
    }
  }

  async resetSmsCache(phoneNumber?: string): Promise<void> {
    try {
      if (phoneNumber) {
        // Reset specific phone number
        await this.redisService.del(this.getSmsAttemptKey(phoneNumber));
        await this.redisService.del(this.getSmsBlockKey(phoneNumber));
        await this.redisService.del(this.getOtpKey(phoneNumber));
      } else {
        // Reset all SMS-related cache
        const keys = await this.redisService.keys('sms_*');
        if (keys.length > 0) {
          await this.redisService.delMultiple(keys);
        }
      }
    } catch (error) {
      console.error('Redis error in resetSmsCache:', error);
    }
  }

  async getSmsStatus(phoneNumber: string): Promise<{
    attempts: number;
    isBlocked: boolean;
    blockedUntil?: Date;
    remainingAttempts: number;
  }> {
    try {
      const attempts = await this.redisService.get(this.getSmsAttemptKey(phoneNumber));
      const attemptCount = attempts ? parseInt(attempts) : 0;
      
      const blockedUntil = await this.redisService.get(this.getSmsBlockKey(phoneNumber));
      const isBlocked = blockedUntil ? new Date(blockedUntil) > new Date() : false;
      
      return {
        attempts: attemptCount,
        isBlocked,
        blockedUntil: blockedUntil ? new Date(blockedUntil) : undefined,
        remainingAttempts: Math.max(0, 3 - attemptCount),
      };
    } catch (error) {
      console.error('Redis error in getSmsStatus:', error);
      return {
        attempts: 0,
        isBlocked: false,
        remainingAttempts: 3,
      };
    }
  }
} 