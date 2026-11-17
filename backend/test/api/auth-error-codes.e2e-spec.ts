import { CryptoUtil } from '../../src/common/utils/crypto.util';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Err = { code?: string; statusCode: number };

/** Error codes for sign-up, verification, password reset and sign-in (mobile-api issue #345). */
describe('auth error codes', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let crypto: CryptoUtil;
  const password = 'Codes#Pass123';
  let n = 0;
  const phone = () => `019${String(Date.now() + n++).slice(-8)}`;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    crypto = t.app.get(CryptoUtil);
  });

  afterAll(async () => {
    await t.close();
  });

  const register = (body: Record<string, unknown>) => t.api.post<Err>('/auth/register', { full_name: 'Code Test', password, confirm_password: password, ...body });

  it('says a phone or email is already registered', async () => {
    const user = await make.student({ password: await crypto.hashPassword(password) });
    expect((await register({ phone: user.phone, email: `new.${phone()}@example.test` })).body.code).toBe('PHONE_ALREADY_REGISTERED');
    expect((await register({ phone: phone(), email: user.email })).body.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('tells a wrong code from an expired one, then locks after five wrong codes', async () => {
    const fresh = phone();
    expect((await register({ phone: fresh, email: `fresh.${fresh}@example.test` })).status).toBeLessThan(300);
    const wrong = await t.api.post<Err>('/auth/register/verify-otp', { phone: fresh, otp: '000000' });
    expect(wrong.body.code).toBe('OTP_INVALID');
    let last = wrong;
    for (let i = 0; i < 5 && last.status !== 429; i += 1) last = await t.api.post<Err>('/auth/register/verify-otp', { phone: fresh, otp: '000000' });
    expect(last.status).toBe(429);
    expect(last.body.code).toBe('OTP_LOCKED');

    const unverified = await make.student({ is_otp_verified: false, is_verified: false });
    expect((await t.api.post<Err>('/auth/register/verify-otp', { phone: unverified.phone, otp: '123456' })).body.code).toBe('OTP_EXPIRED');
    expect((await t.api.post<Err>('/auth/register/verify-otp', { phone: phone(), otp: '123456' })).body.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('sends a new code when sign-up is repeated (the way to resend), until the SMS limit', async () => {
    const same = phone();
    const body = { phone: same, email: `again.${same}@example.test` };
    for (let i = 0; i < 3; i += 1) expect((await register(body)).status).toBeLessThan(300);
    const fourth = await register(body);
    expect(fourth.status).toBe(400);
    expect(fourth.body.code).toBe('OTP_SEND_FAILED');
  });

  it('says when no account has that phone or email on forgot and reset', async () => {
    expect((await t.api.post<Err>('/auth/forgot-password', { identifier: phone() })).body.code).toBe('ACCOUNT_NOT_FOUND');
    const user = await make.student();
    expect((await t.api.post<Err>('/auth/reset-password/verify-otp', { identifier: user.phone, otp: '123456' })).body.code).toBe('OTP_EXPIRED');
  });

  it('tells wrong credentials from an unverified phone on sign-in', async () => {
    const user = await make.student({ password: await crypto.hashPassword(password) });
    expect((await t.api.post<Err>('/auth/login', { phone: user.phone, password: 'Wrong#Pass123' })).body.code).toBe('INVALID_CREDENTIALS');
    const unverified = await make.student({ password: await crypto.hashPassword(password), is_otp_verified: false, is_verified: false });
    expect((await t.api.post<Err>('/auth/login', { phone: unverified.phone, password })).body.code).toBe('ACCOUNT_NOT_VERIFIED');
  });
});
