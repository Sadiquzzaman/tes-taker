import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InMemoryRedis } from 'src/common/testing/in-memory-redis';
import { OTP_LOCKOUT_SECONDS, SmsRateLimitService } from 'src/sms/sms-rate-limit.service';
import { AuthService } from './auth.service';

describe('AuthService password-reset OTP', () => {
  const identifier = '01712345678';
  const user = { id: 'user-1', phone: identifier, email: null, full_name: 'Test User' };
  let smsRateLimitService: SmsRateLimitService;
  let userService: { findByPhoneOrEmail: jest.Mock; updatePassword: jest.Mock };
  let smsService: { generateOtp: jest.Mock; sendSms: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T08:00:00Z'));
    smsRateLimitService = new SmsRateLimitService(new InMemoryRedis() as never);
    userService = {
      findByPhoneOrEmail: jest.fn().mockResolvedValue(user),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    smsService = {
      generateOtp: jest.fn().mockReturnValue('482913'),
      sendSms: jest.fn().mockResolvedValue(true),
    };
    service = new AuthService(
      userService as never,
      smsService as never,
      smsRateLimitService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  const lockedError = async (promise: Promise<unknown>) => {
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  };

  it('keeps the SMS forgot-password flow working with the right code', async () => {
    const sent = await service.forgotPassword({ identifier });
    expect(sent.data.channel).toBe('sms');
    expect(smsService.sendSms).toHaveBeenCalledWith(identifier, expect.stringContaining('482913'));

    await expect(service.verifyResetOtp({ identifier, otp: '482913' })).resolves.toMatchObject({ success: true });
    await expect(
      service.resetPassword({ identifier, otp: '482913', password: 'NewPass123!', confirm_password: 'NewPass123!' }),
    ).resolves.toMatchObject({ success: true });
    expect(userService.updatePassword).toHaveBeenCalledWith('user-1', 'NewPass123!');
  });

  it('returns "Invalid OTP" for a wrong code below the limit', async () => {
    await service.forgotPassword({ identifier });
    await expect(service.verifyResetOtp({ identifier, otp: '111111' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks verify, reset and resend after 5 wrong codes, even with the right code', async () => {
    await service.forgotPassword({ identifier });
    for (let i = 0; i < 4; i++) {
      await expect(service.verifyResetOtp({ identifier, otp: '111111' })).rejects.toBeInstanceOf(BadRequestException);
    }
    await lockedError(service.verifyResetOtp({ identifier, otp: '111111' }));

    await lockedError(service.verifyResetOtp({ identifier, otp: '482913' }));
    await lockedError(
      service.resetPassword({ identifier, otp: '482913', password: 'NewPass123!', confirm_password: 'NewPass123!' }),
    );
    smsService.sendSms.mockClear();
    await lockedError(service.forgotPassword({ identifier }));
    expect(smsService.sendSms).not.toHaveBeenCalled();
    expect(userService.updatePassword).not.toHaveBeenCalled();

    // After the lockout a fresh code works.
    jest.advanceTimersByTime(OTP_LOCKOUT_SECONDS * 1000 + 1000);
    await service.forgotPassword({ identifier });
    await expect(service.verifyResetOtp({ identifier, otp: '482913' })).resolves.toMatchObject({ success: true });
  });

  it('counts wrong codes sent to reset-password too', async () => {
    await service.forgotPassword({ identifier });
    for (let i = 0; i < 4; i++) {
      await expect(
        service.resetPassword({ identifier, otp: '111111', password: 'NewPass123!', confirm_password: 'NewPass123!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await lockedError(service.verifyResetOtp({ identifier, otp: '111111' }));
  });
});
