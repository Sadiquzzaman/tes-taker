import { CryptoUtil } from '../../src/common/utils/crypto.util';
import { RefreshTokenUtil } from '../../src/common/utils/refresh-token.util';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { RefreshTokenEntity } from '../../src/user/entities/refresh-token.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Tokens = { access_token: string; refresh_token: string };
type Payload<T> = { payload: T };
type Device = { id: string; platform: string; device_name: string | null; app_version: string | null; current: boolean };

/** PM-01: each signed-in device keeps its own rotating refresh token. */
describe('signed-in devices (PM-01)', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let crypto: CryptoUtil;
  const password = 'Device#Pass123';

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    crypto = t.app.get(CryptoUtil);
  });

  afterAll(async () => {
    await t.close();
  });

  const newUser = async () => make.teacher({ password: await crypto.hashPassword(password) });
  const login = async (user: UserEntity, device?: Record<string, string>) => {
    const response = await t.api.post<Payload<Tokens>>('/auth/login', { phone: user.phone, password, ...(device ? { device } : {}) });
    expect(response.status).toBe(200);
    return response.body.payload;
  };
  const refresh = (refreshToken: string, extra: Record<string, unknown> = {}) =>
    t.api.post<Payload<Tokens>>('/auth/refresh', { refreshToken, ...extra });
  const devices = async (accessToken: string) => {
    const response = await t.api.get<Payload<Device[]>>('/auth/sessions', accessToken);
    expect(response.status).toBe(200);
    return response.body.payload;
  };
  const rows = (userId: string) => t.dataSource.getRepository(RefreshTokenEntity).find({ where: { user_id: userId } });

  it('keeps the web and the phone signed in side by side', async () => {
    const user = await newUser();
    const web = await login(user);
    const phone = await login(user, { platform: 'ANDROID', name: 'Pixel 8', app_version: '1.0.0' });

    // Before PM-01 the phone's login replaced the web's token, so this refresh failed.
    const webRefresh = await refresh(web.refresh_token);
    expect(webRefresh.status).toBe(200);
    const phoneRefresh = await refresh(phone.refresh_token, { device: { platform: 'ANDROID', app_version: '1.0.1' } });
    expect(phoneRefresh.status).toBe(200);

    const list = await devices(phoneRefresh.body.payload.access_token);
    expect(list).toHaveLength(2);
    expect(list.find((d) => d.current)).toMatchObject({ platform: 'ANDROID', device_name: 'Pixel 8', app_version: '1.0.1' });
    expect(list.find((d) => !d.current)).toMatchObject({ platform: 'WEB' });
  });

  it('rotates the token on refresh; a replaced token works only during the grace, then signs the device out', async () => {
    const user = await newUser();
    const first = await login(user);
    const second = (await refresh(first.refresh_token)).body.payload;
    expect(second.refresh_token).not.toBe(first.refresh_token);

    // Two tabs refreshing at once: the replaced token still counts for 60 seconds.
    const sameMoment = await refresh(first.refresh_token);
    expect(sameMoment.status).toBe(200);
    const latest = sameMoment.body.payload;

    // Later, the token it replaced is a stolen one: the device is signed out.
    await t.dataSource.query(`UPDATE refresh_tokens SET rotated_at = now() - interval '2 minutes' WHERE user_id = $1`, [user.id]);
    expect((await refresh(second.refresh_token)).status).toBe(401);
    expect((await refresh(latest.refresh_token)).status).toBe(401);
    const [row] = await rows(user.id);
    expect(row).toMatchObject({ revoked_reason: 'REUSED' });
    expect(row.revoked_at).not.toBeNull();
  });

  it('keeps the same device when switching workspace', async () => {
    const owner = await newUser();
    const organization: OrganizationEntity = await make.organization(owner);
    const signedIn = await login(owner);
    const switched = await t.api.post<Payload<Tokens & { organization: { id: string } }>>(
      '/auth/select-context',
      { type: 'organization', organization_id: organization.id },
      signedIn.access_token,
    );
    expect(switched.status).toBe(200);
    expect(switched.body.payload.organization.id).toBe(organization.id);
    expect(await rows(owner.id)).toHaveLength(1);

    const orgRefresh = await refresh(switched.body.payload.refresh_token, { organization_id: organization.id });
    expect(orgRefresh.status).toBe(200);
    expect(await rows(owner.id)).toHaveLength(1);
  });

  it('signs out this device only on logout, and ignores unknown tokens', async () => {
    const user = await newUser();
    const web = await login(user);
    const phone = await login(user, { platform: 'IOS', name: 'iPhone' });

    expect((await t.api.post('/auth/logout', { refreshToken: web.refresh_token })).status).toBe(200);
    expect((await refresh(web.refresh_token)).status).toBe(401);
    expect((await refresh(phone.refresh_token)).status).toBe(200);
    expect((await t.api.post('/auth/logout', { refreshToken: 'not-a-token' })).status).toBe(200);
  });

  it('signs out one device or all others, and never another user\'s device', async () => {
    const user = await newUser();
    const stranger = await newUser();
    const a = await login(user);
    const b = await login(user, { platform: 'ANDROID', name: 'Phone B' });
    const c = await login(user, { platform: 'IOS', name: 'Phone C' });
    const strangerSession = await login(stranger);

    const list = await devices(a.access_token);
    const phoneB = list.find((d) => d.device_name === 'Phone B')!;
    const strangerDevice = (await devices(strangerSession.access_token))[0];

    expect((await t.api.request('DELETE', `/auth/sessions/${strangerDevice.id}`, { token: a.access_token })).status).toBe(404);
    expect((await t.api.request('DELETE', `/auth/sessions/${phoneB.id}`, { token: a.access_token })).status).toBe(200);
    expect((await t.api.request('DELETE', `/auth/sessions/${phoneB.id}`, { token: a.access_token })).status).toBe(404);
    expect((await refresh(b.refresh_token)).status).toBe(401);
    expect((await refresh(strangerSession.refresh_token)).status).toBe(200);

    const others = await t.api.post<Payload<{ signed_out: number }>>('/auth/sessions/revoke-others', {}, a.access_token);
    expect(others.body.payload.signed_out).toBe(1);
    expect((await refresh(c.refresh_token)).status).toBe(401);
    expect((await refresh(a.refresh_token)).status).toBe(200);
  });

  it('signs out the other devices when the password changes', async () => {
    const user = await newUser();
    const here = await login(user);
    const elsewhere = await login(user, { platform: 'ANDROID' });
    const changed = await t.api.post(
      '/auth/change-password',
      { current_password: password, new_password: 'Next#Pass1234', confirm_password: 'Next#Pass1234' },
      here.access_token,
    );
    expect(changed.status).toBeLessThan(300);
    expect((await refresh(elsewhere.refresh_token)).status).toBe(401);
    expect((await refresh(here.refresh_token)).status).toBe(200);
    const [elsewhereRow] = (await rows(user.id)).filter((row) => row.platform === 'ANDROID');
    expect(elsewhereRow.revoked_reason).toBe('PASSWORD_CHANGED');
  });

  it('moves a token from before PM-01 (users.refresh_token) into a device, once', async () => {
    const util = t.app.get(RefreshTokenUtil);
    const legacy = util.generate();
    const user = await make.teacher({ refresh_token: legacy.hash });

    const first = await refresh(legacy.token);
    expect(first.status).toBe(200);
    expect(await rows(user.id)).toHaveLength(1);
    const stored = await t.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .addSelect('u.refresh_token')
      .where('u.id = :id', { id: user.id })
      .getOne();
    expect(stored?.refresh_token).toBeNull();
    // The new token works; the old one no longer does once its grace has passed.
    expect((await refresh(first.body.payload.refresh_token)).status).toBe(200);
  });

  it('refuses a disabled account', async () => {
    const user = await newUser();
    const signedIn = await login(user);
    await t.dataSource.query(`UPDATE users SET is_active = '0' WHERE id = $1`, [user.id]);
    expect((await refresh(signedIn.refresh_token)).status).toBe(401);
  });

  it('needs a signed-in user for the device list', async () => {
    expect((await t.api.get('/auth/sessions')).status).toBe(401);
    expect((await t.api.post('/auth/sessions/revoke-others', {})).status).toBe(401);
  });
});
