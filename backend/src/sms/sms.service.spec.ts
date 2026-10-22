import * as crypto from 'crypto';
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
