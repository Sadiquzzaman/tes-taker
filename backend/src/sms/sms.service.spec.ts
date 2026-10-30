import * as crypto from 'crypto';
import axios from 'axios';
import { HttpStatus } from '@nestjs/common';
import { InMemoryRedis } from 'src/common/testing/in-memory-redis';
import { SmsRateLimitService } from './sms-rate-limit.service';
import { SmsService } from './sms.service';

describe('SmsService.generateOtp', () => {
  const service = new SmsService({} as never, {} as never, {} as never);

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
    service = new SmsService({} as never, rateLimit, { enqueue: jest.fn().mockResolvedValue(['id']) } as never);
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
  let enqueue: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T08:00:00Z'));
    rateLimit = new SmsRateLimitService(new InMemoryRedis() as never);
    enqueue = jest.fn().mockResolvedValue(['id']);
    service = new SmsService({} as never, rateLimit, { enqueue } as never);
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
    expect(enqueue).toHaveBeenCalledTimes(3);
  });

  it('queues the code as an urgent, platform-paid SMS through the outbox', async () => {
    jest.spyOn(service, 'generateOtp').mockReturnValue('482913');
    await service.sendOtp(phone, 'bn');

    expect(enqueue).toHaveBeenCalledWith({
      eventType: 'auth.otp',
      channel: 'SMS',
      organizationId: null,
      address: phone,
      locale: 'bn',
      variables: { otp: '482913' },
      urgent: true,
    });
    await expect(service.verifyOtp(phone, '482913')).resolves.toMatchObject({ success: true });
  });

  it('allows sending again after the 1-hour block', async () => {
    for (let i = 0; i < 4; i++) {
      await service.sendOtp(phone);
    }

    jest.advanceTimersByTime(60 * 60 * 1000 + 1000);

    await expect(service.sendOtp(phone)).resolves.toMatchObject({ success: true });
    expect(enqueue).toHaveBeenCalledTimes(4);
  });
});

describe('SmsService.deliver (worker only)', () => {
  const config = { get: (key: string) => ({ BULKSMS_API_KEY: 'test-key', BULKSMS_SENDER_ID: 'test' })[key] };
  const service = new SmsService(config as never, {} as never, {} as never);

  afterEach(() => jest.restoreAllMocks());

  it('returns the message id when BulkSMS accepts the SMS (response_code 202)', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { response_code: 202, message_id: 991 } });
    await expect(service.deliver('01700000002', 'আসন্ন পরীক্ষা')).resolves.toEqual({ messageId: '991' });
    const url = post.mock.calls[0][0];
    expect(url).toContain('number=01700000002');
    expect(url).toContain(`message=${encodeURIComponent('আসন্ন পরীক্ষা')}`);
  });

  it('throws when BulkSMS rejects it, so the worker retries', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { response_code: 1007, error_message: 'Balance insufficient' } });
    await expect(service.deliver('01700000002', 'Hi')).rejects.toThrow('BulkSMS rejected the SMS: Balance insufficient');
  });

  it('throws when the API key is missing', async () => {
    const unconfigured = new SmsService({ get: () => undefined } as never, {} as never, {} as never);
    await expect(unconfigured.deliver('01700000002', 'Hi')).rejects.toThrow('BULKSMS_API_KEY is not configured');
  });
});
