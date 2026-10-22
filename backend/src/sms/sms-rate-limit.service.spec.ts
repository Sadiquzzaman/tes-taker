import { HttpException, HttpStatus } from '@nestjs/common';
import { InMemoryRedis } from 'src/common/testing/in-memory-redis';
import {
  OTP_LOCKOUT_SECONDS,
  OTP_MAX_WRONG_ATTEMPTS,
  SmsRateLimitService,
} from './sms-rate-limit.service';

describe('SmsRateLimitService OTP lockout', () => {
  const identifier = 'user@example.com';
  const rightCode = '482913';
  const wrongCode = '000000';
  let redis: InMemoryRedis;
  let service: SmsRateLimitService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T08:00:00Z'));
    redis = new InMemoryRedis();
    service = new SmsRateLimitService(redis as never);
  });

  afterEach(() => jest.useRealTimers());

  const expectLocked = async (promise: Promise<unknown>) => {
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((error as HttpException).message).toMatch(/Too many wrong codes/);
  };

  it('accepts the right code within the limit and clears earlier wrong guesses', async () => {
    for (let i = 0; i < OTP_MAX_WRONG_ATTEMPTS - 1; i++) {
      await expect(service.checkOtpAttempt('reset', identifier, wrongCode, rightCode)).resolves.toBe('invalid');
    }
    await expect(service.checkOtpAttempt('reset', identifier, rightCode, rightCode)).resolves.toBe('valid');

    // Counter was reset, so another 4 wrong codes still do not lock.
    for (let i = 0; i < OTP_MAX_WRONG_ATTEMPTS - 1; i++) {
      await expect(service.checkOtpAttempt('reset', identifier, wrongCode, rightCode)).resolves.toBe('invalid');
    }
  });

  it('locks on the 5th wrong code and rejects the right code on the 6th try until the lockout ends', async () => {
    for (let i = 0; i < OTP_MAX_WRONG_ATTEMPTS - 1; i++) {
      await expect(service.checkOtpAttempt('reset', identifier, wrongCode, rightCode)).resolves.toBe('invalid');
    }
    await expectLocked(service.checkOtpAttempt('reset', identifier, wrongCode, rightCode));

    // 6th attempt, correct code: still locked.
    await expectLocked(service.checkOtpAttempt('reset', identifier, rightCode, rightCode));

    // Just before the lockout ends: still locked.
    jest.advanceTimersByTime((OTP_LOCKOUT_SECONDS - 1) * 1000);
    await expectLocked(service.checkOtpAttempt('reset', identifier, rightCode, rightCode));

    // After 15 minutes the right code works again.
    jest.advanceTimersByTime(2000);
    await expect(service.checkOtpAttempt('reset', identifier, rightCode, rightCode)).resolves.toBe('valid');
  });

  it('keeps the lock when a new code is requested', async () => {
    for (let i = 0; i < OTP_MAX_WRONG_ATTEMPTS; i++) {
      await service.checkOtpAttempt('reset', identifier, wrongCode, rightCode).catch(() => undefined);
    }
    await expectLocked(service.assertOtpNotLocked('reset', identifier));
  });

  it('treats identifiers case-insensitively and keeps purposes separate', async () => {
    for (let i = 0; i < OTP_MAX_WRONG_ATTEMPTS; i++) {
      await service.checkOtpAttempt('reset', identifier, wrongCode, rightCode).catch(() => undefined);
    }
    await expectLocked(service.checkOtpAttempt('reset', identifier.toUpperCase(), rightCode, rightCode));
    await expect(service.checkOtpAttempt('register', identifier, rightCode, rightCode)).resolves.toBe('valid');
  });

  it('reports an expired code without counting it as a wrong guess', async () => {
    for (let i = 0; i < OTP_MAX_WRONG_ATTEMPTS + 2; i++) {
      await expect(service.checkOtpAttempt('register', '01700000000', rightCode, null)).resolves.toBe('expired');
    }
    await expect(service.assertOtpNotLocked('register', '01700000000')).resolves.toBeUndefined();
  });
});
