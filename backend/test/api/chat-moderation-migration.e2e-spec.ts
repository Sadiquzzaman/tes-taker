import { ChatModeration1756430000000 } from '../../src/migrations/1756430000000-ChatModeration';
import { createTestApp, TestApp } from '../support/test-app';

/** Chat moderation (P9-02): the access log and report tables are created safely twice, with a count check, and reverted. */
describe('ChatModeration migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates chat_access_logs and message_reports, safely twice, and reverts', async () => {
    const migration = new ChatModeration1756430000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async (table: string) => (await runner.query(`SELECT to_regclass('public.${table}') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect([await exists('chat_access_logs'), await exists('message_reports')]).toEqual([false, false]);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect([await exists('chat_access_logs'), await exists('message_reports')]).toEqual([true, true]);
      expect(log).toHaveBeenCalledWith('[ChatModeration] access logs: 0, reports: 0');
    } finally {
      await runner.release();
    }
  });
});
