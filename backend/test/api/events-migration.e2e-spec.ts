import { Events1756310000000 } from '../../src/migrations/1756310000000-Events';
import { createTestApp, TestApp } from '../support/test-app';

/** Calendar events tables (P5-05 part 1): created empty, safely twice, with a count check, and reverted. */
describe('Events migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates the events tables, safely twice, and reverts', async () => {
    const migration = new Events1756310000000();
    const runner = t.dataSource.createQueryRunner();
    const tables = async () =>
      (await runner.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('events', 'event_attendees')`))[0].n;
    try {
      await migration.down(runner);
      expect(await tables()).toBe(0);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await tables()).toBe(2);
      expect(log).toHaveBeenCalledWith('[Events] events: 0, attendees: 0');
    } finally {
      await runner.release();
    }
  });
});
