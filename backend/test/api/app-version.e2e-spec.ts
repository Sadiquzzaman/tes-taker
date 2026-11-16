import { createTestApp, TestApp } from '../support/test-app';

type Info = { payload: { platform: string; minimum: string; latest: string; update_url: string | null; update: string | null } };

/** PM-03: the mobile app asks which versions the API still serves. */
describe('app version check', () => {
  let t: TestApp;
  const saved = { ...process.env };

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) if (key.startsWith('APP_') && !(key in saved)) delete process.env[key];
  });

  afterAll(async () => {
    await t.close();
  });

  it('accepts every version while nothing is set, without signing in', async () => {
    const res = await t.api.get<Info>('/app/version?platform=android&current=0.1.0');
    expect(res.status).toBe(200);
    expect(res.body.payload).toEqual({ platform: 'ANDROID', minimum: '0.0.0', latest: '0.0.0', update_url: null, update: 'NONE' });
  });

  it('says when an update is required or optional, per platform', async () => {
    process.env.APP_MIN_VERSION_IOS = '1.2.0';
    process.env.APP_LATEST_VERSION_IOS = '1.4.0';
    process.env.APP_UPDATE_URL_IOS = 'https://example.test/ios';
    expect((await t.api.get<Info>('/app/version?platform=IOS&current=1.1.9')).body.payload).toMatchObject({ update: 'REQUIRED', update_url: 'https://example.test/ios' });
    expect((await t.api.get<Info>('/app/version?platform=IOS&current=1.3.0')).body.payload.update).toBe('OPTIONAL');
    expect((await t.api.get<Info>('/app/version?platform=IOS')).body.payload).toMatchObject({ minimum: '1.2.0', latest: '1.4.0', update: null });
    expect((await t.api.get<Info>('/app/version?platform=ANDROID&current=1.0.0')).body.payload.update).toBe('NONE');
  });

  it('refuses an unknown platform or a malformed version', async () => {
    expect((await t.api.get('/app/version?platform=windows')).status).toBe(400);
    expect((await t.api.get('/app/version?platform=ANDROID&current=abc')).status).toBe(400);
  });
});
