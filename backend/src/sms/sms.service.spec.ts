import * as crypto from 'crypto';
import { HttpStatus } from '@nestjs/common';
import { InMemoryRedis } from 'src/common/testing/in-memory-redis';
import { SmsRateLimitService } from './sms-rate-limit.service';
import { SmsService } from './sms.service';

describe('SmsService.generateOtp', () => {
  const service = new SmsService({} as never, {} as never);

  afterEach(() => jest.restoreAllMocks());

  it('uses crypto.randomInt over the 6-digit range', () => {
    const spy = jest.spyOn(crypto, 'randomInt');
    service.generateOtp();
    expect(spy).toHaveBeenCalledWith(100000, 1000000);
  });

  it('returns the value from crypto.randomInt as a string', () => {
    jest.spyOn(crypto, 'randomInt').mockImplementation((() => 424242) as never);
    expect(service.generateOtp()).toBe('424242');
  });

  it('always returns exactly 6 digits between 100000 and 999999', () => {
    for (let i = 0; i < 10000; i++) {
      const otp = service.generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      const n = Number(otp);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });
});

describe('SmsService registration OTP lockout', () => {
  const phone = '01700000000';
  let rateLimit: SmsRateLimitService;
  let service: SmsService;

  beforeEach(async () => {
    rateLimit = new SmsRateLimitService(new InMemoryRedis() as never);
    service = new SmsService({} as never, rateLimit);
    await rateLimit.storeOtp(phone, '482913');
  });

  it('verifies the right code', async () => {
    await expect(service.verifyOtp(phone, '482913')).resolves.toMatchObject({ success: true });
  });

  it('locks after 5 wrong codes and refuses the right code and a resend', async () => {
    for (let i = 0; i < 4; i++) {
      await expect(service.verifyOtp(phone, '111111')).resolves.toMatchObject({ success: false });
    }
    await expect(service.verifyOtp(phone, '111111')).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    await expect(service.verifyOtp(phone, '482913')).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    await expect(service.sendOtp(phone)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });
});

describe('SmsService.sendOtp send limit', () => {
  const phone = '01700000001';
  let rateLimit: SmsRateLimitService;
  let service: SmsService;
  let sendSms: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T08:00:00Z'));
    rateLimit = new SmsRateLimitService(new InMemoryRedis() as never);
    service = new SmsService({} as never, rateLimit);
    sendSms = jest.spyOn(service, 'sendSms').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('sends 3 OTP SMS, then refuses the 4th without sending', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(service.sendOtp(phone)).resolves.toMatchObject({ success: true });
    }

    const blocked = await service.sendOtp(phone);

    expect(blocked.success).toBe(false);
    expect(blocked.message).toMatch(/SMS blocked until/);
    expect(sendSms).toHaveBeenCalledTimes(3);
  });

  it('allows sending again after the 1-hour block', async () => {
    for (let i = 0; i < 4; i++) {
      await service.sendOtp(phone);
    }

    jest.advanceTimersByTime(60 * 60 * 1000 + 1000);

    await expect(service.sendOtp(phone)).resolves.toMatchObject({ success: true });
    expect(sendSms).toHaveBeenCalledTimes(4);
  });
});
