import { ProctoringEvents1756400000000 } from '../../src/migrations/1756400000000-ProctoringEvents';
import { createTestApp, TestApp } from '../support/test-app';

/** Proctoring events (P8-02): the table is created safely twice, with a count check, and reverted. */
describe('ProctoringEvents migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates proctoring_events, safely twice, and reverts', async () => {
    const migration = new ProctoringEvents1756400000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () => (await runner.query(`SELECT to_regclass('public.proctoring_events') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[ProctoringEvents] events: 0');
    } finally {
      await runner.release();
    }
  });
});
