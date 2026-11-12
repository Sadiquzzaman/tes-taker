import { CalendarFeedTokens1756320000000 } from '../../src/migrations/1756320000000-CalendarFeedTokens';
import { PersonalCalendarLinks1756340000000 } from '../../src/migrations/1756340000000-PersonalCalendarLinks';
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
      // The test database may hold personal links from other suites; this test drops the table anyway.
      await runner.query(`DELETE FROM calendar_feed_tokens WHERE organization_id IS NULL`);
      await new PersonalCalendarLinks1756340000000().down(runner);
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[CalendarFeedTokens] tokens: 0');
      // Later migrations on this table run again, so the schema ends as it was.
      await new PersonalCalendarLinks1756340000000().up(runner);
    } finally {
      await runner.release();
    }
  });
});
