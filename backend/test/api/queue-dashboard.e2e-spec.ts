import { BULL_BOARD_PATH, mountBullBoard } from '../../src/queue/bull-board';
import { createTestApp, TestApp } from '../support/test-app';

/** bull-board on the real HTTP server: only reachable with the configured basic-auth login. */
describe('queue dashboard (bull-board)', () => {
  let t: TestApp;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.BULL_BOARD_USER = 'ops';
    process.env.BULL_BOARD_PASSWORD = 'a-long-test-only-password';
    t = await createTestApp({ beforeListen: (app) => mountBullBoard(app) });
    baseUrl = (await t.app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    delete process.env.BULL_BOARD_USER;
    delete process.env.BULL_BOARD_PASSWORD;
    await t.close();
  });

  const get = (path: string, auth?: string) =>
    fetch(`${baseUrl}${path}`, { headers: auth ? { Authorization: `Basic ${Buffer.from(auth).toString('base64')}` } : {} });

  it('asks for a login', async () => {
    const response = await get(BULL_BOARD_PATH);

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('Basic');
  });

  it('refuses a wrong password', async () => {
    await expect(get(BULL_BOARD_PATH, 'ops:wrong')).resolves.toMatchObject({ status: 401 });
  });

  it('shows the dashboard and the exams queue with the right login', async () => {
    const page = await get(BULL_BOARD_PATH, 'ops:a-long-test-only-password');
    const queues = await get(`${BULL_BOARD_PATH}/api/queues`, 'ops:a-long-test-only-password');

    expect(page.status).toBe(200);
    expect(queues.status).toBe(200);
    expect(JSON.stringify(await queues.json())).toContain('"name":"exams"');
  });

  it('does not touch the normal API', async () => {
    await expect(t.api.request('GET', '/../health')).resolves.toMatchObject({ status: 200 });
  });
});
