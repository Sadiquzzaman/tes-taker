import { ReminderRules1756330000000 } from '../../src/migrations/1756330000000-ReminderRules';
import { createTestApp, TestApp } from '../support/test-app';

/** Reminder rules (P5-05 part 4): the table is created safely twice, with a count check, and reverted. */
describe('ReminderRules migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates reminder_rules, safely twice, and reverts', async () => {
    const migration = new ReminderRules1756330000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () => (await runner.query(`SELECT to_regclass('public.reminder_rules') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[ReminderRules] rules: 0');
    } finally {
      await runner.release();
    }
  });
});
