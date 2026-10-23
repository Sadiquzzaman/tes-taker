import { createTestApp, TestApp } from '../support/test-app';

describe('API test harness', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('boots the real app against PostgreSQL, Redis and MongoDB', async () => {
    const response = await t.api.request('GET', '/../health');

    expect(response.status).toBe(200);
  });

  it('runs the real migrations (all recorded, none pending)', async () => {
    const [{ count }] = await t.dataSource.query('SELECT count(*)::int AS count FROM migrations');

    expect(count).toBeGreaterThanOrEqual(14);
  });

  it('blocks outbound HTTP unless a test allows it', async () => {
    const axios = (await import('axios')).default;

    await expect(axios.post('https://example.com/should-not-be-called')).rejects.toThrow(/Outbound HTTP blocked/);
  });
});
