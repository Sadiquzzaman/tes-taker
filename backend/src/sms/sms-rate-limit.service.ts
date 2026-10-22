import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { RedisService } from '../config/redis.service';

/** Which OTP flow a code belongs to; each flow has its own wrong-guess counter. */
export type OtpPurpose = 'register' | 'reset';

export type OtpCheckResult = 'valid' | 'invalid' | 'expired';

/** Wrong codes allowed before the identifier is locked (design §8.2). */
export const OTP_MAX_WRONG_ATTEMPTS = 5;
/** How long a locked identifier stays locked, and the window wrong codes are counted in. */
export const OTP_LOCKOUT_SECONDS = 15 * 60;

function otpMatches(stored: string, submitted: string): boolean {
  const a = Buffer.from(stored);
  const b = Buffer.from(String(submitted ?? ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class SmsRateLimitService {
  private readonly logger = new Logger(SmsRateLimitService.name);

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

  private getPasswordResetOtpKey(identifier: string): string {
    return `pwd_reset_otp:${identifier.toLowerCase()}`;
  }

  private getOtpFailKey(purpose: OtpPurpose, identifier: string): string {
    return `otp_fail:${purpose}:${identifier.toLowerCase()}`;
  }

  private getOtpLockKey(purpose: OtpPurpose, identifier: string): string {
    return `otp_lock:${purpose}:${identifier.toLowerCase()}`;
  }

  private otpLockedException(secondsLeft: number): HttpException {
    const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
    return new HttpException(
      `Too many wrong codes. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Throws 429 while the identifier is locked after too many wrong codes.
   * Redis errors are not swallowed here: if the lock can't be read, the
   * request fails instead of silently allowing unlimited guesses.
   */
  async assertOtpNotLocked(purpose: OtpPurpose, identifier: string): Promise<void> {
    const lockKey = this.getOtpLockKey(purpose, identifier);
    if (await this.redisService.get(lockKey)) {
      const ttl = await this.redisService.ttl(lockKey);
      throw this.otpLockedException(ttl > 0 ? ttl : OTP_LOCKOUT_SECONDS);
    }
  }

  /**
   * Checks a submitted OTP against the stored one and counts wrong guesses.
   * After OTP_MAX_WRONG_ATTEMPTS wrong codes the identifier is locked for
   * OTP_LOCKOUT_SECONDS; while locked every attempt (even the right code) gets
   * 429. A correct code clears the counter. Asking for a new code does not
   * lift the lock.
   */
  async checkOtpAttempt(
    purpose: OtpPurpose,
    identifier: string,
    submittedOtp: string,
    storedOtp: string | null,
  ): Promise<OtpCheckResult> {
    await this.assertOtpNotLocked(purpose, identifier);

    if (!storedOtp) {
      return 'expired';
    }

    const failKey = this.getOtpFailKey(purpose, identifier);
    if (otpMatches(storedOtp, submittedOtp)) {
      await this.redisService.del(failKey);
      return 'valid';
    }

    const failures = await this.redisService.incrWithTtl(failKey, OTP_LOCKOUT_SECONDS);
    if (failures >= OTP_MAX_WRONG_ATTEMPTS) {
      await this.redisService.set(
        this.getOtpLockKey(purpose, identifier),
        new Date(Date.now() + OTP_LOCKOUT_SECONDS * 1000).toISOString(),
        OTP_LOCKOUT_SECONDS,
      );
      await this.redisService.del(failKey);
      this.logger.warn(`OTP locked for ${purpose} after ${failures} wrong codes`);
      throw this.otpLockedException(OTP_LOCKOUT_SECONDS);
    }
    return 'invalid';
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
      this.logger.error('Redis error in canSendSms:', error);
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
      this.logger.error('Redis error in recordSmsAttempt:', error);
    }
  }

  async storeOtp(phoneNumber: string, otp: string): Promise<void> {
    try {
      const key = this.getOtpKey(phoneNumber);
      await this.redisService.set(key, otp, 300); // 5 minutes TTL
    } catch (error) {
      this.logger.error('Redis error in storeOtp:', error);
    }
  }

  async getOtp(phoneNumber: string): Promise<string | null> {
    try {
      const key = this.getOtpKey(phoneNumber);
      return await this.redisService.get(key);
    } catch (error) {
      this.logger.error('Redis error in getOtp:', error);
      return null;
    }
  }

  async removeOtp(phoneNumber: string): Promise<void> {
    try {
      const key = this.getOtpKey(phoneNumber);
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error('Redis error in removeOtp:', error);
    }
  }

  async storePasswordResetOtp(identifier: string, otp: string): Promise<void> {
    try {
      await this.redisService.set(this.getPasswordResetOtpKey(identifier), otp, 300); // 5 minutes TTL
    } catch (error) {
      this.logger.error('Redis error in storePasswordResetOtp:', error);
    }
  }

  async getPasswordResetOtp(identifier: string): Promise<string | null> {
    try {
      return await this.redisService.get(this.getPasswordResetOtpKey(identifier));
    } catch (error) {
      this.logger.error('Redis error in getPasswordResetOtp:', error);
      return null;
    }
  }

  async removePasswordResetOtp(identifier: string): Promise<void> {
    try {
      await this.redisService.del(this.getPasswordResetOtpKey(identifier));
    } catch (error) {
      this.logger.error('Redis error in removePasswordResetOtp:', error);
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
      this.logger.error('Redis error in resetSmsCache:', error);
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
      this.logger.error('Redis error in getSmsStatus:', error);
      return {
        attempts: 0,
        isBlocked: false,
        remainingAttempts: 3,
      };
    }
  }
} 