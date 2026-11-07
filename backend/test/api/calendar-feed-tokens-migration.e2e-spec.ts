import { CalendarFeedTokens1756320000000 } from '../../src/migrations/1756320000000-CalendarFeedTokens';
import { createTestApp, TestApp } from '../support/test-app';

/** Calendar subscription links (P5-05 part 2): the table is created safely twice, with a count check, and reverted. */
describe('CalendarFeedTokens migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates calendar_feed_tokens, safely twice, and reverts', async () => {
    const migration = new CalendarFeedTokens1756320000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () => (await runner.query(`SELECT to_regclass('public.calendar_feed_tokens') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[CalendarFeedTokens] tokens: 0');
    } finally {
      await runner.release();
    }
  });
});
