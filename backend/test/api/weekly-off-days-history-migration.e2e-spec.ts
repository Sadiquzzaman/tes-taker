import { WeeklyOffDaysHistory1756260000000 } from '../../src/migrations/1756260000000-WeeklyOffDaysHistory';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * The weekly off days history (org_settings.weekly_off_days_history): up adds an empty list to every
 * settings row without touching the off days, runs safely twice, logs a count check and reverts.
 */
describe('WeeklyOffDaysHistory migration', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('adds an empty history to existing settings, safely twice, and reverts', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    const migration = new WeeklyOffDaysHistory1756260000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      const column = async () =>
        (await runner.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'org_settings' AND column_name = 'weekly_off_days_history'`))[0].n;

      await migration.down(runner);
      expect(await column()).toBe(0);
      await runner.query(
        `INSERT INTO org_settings (organization_id, weekly_off_days, created_at, is_active) VALUES ($1, '{5,6}', now(), '1')
         ON CONFLICT (organization_id) DO UPDATE SET weekly_off_days = '{5,6}'`,
        [school.id],
      );

      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await column()).toBe(1);
      const [row] = await runner.query(`SELECT weekly_off_days, weekly_off_days_history FROM org_settings WHERE organization_id = $1`, [school.id]);
      expect(row).toEqual({ weekly_off_days: [5, 6], weekly_off_days_history: [] });
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[WeeklyOffDaysHistory\] org_settings rows: \d+, with an empty history: \d+$/));

      await migration.down(runner);
      expect(await column()).toBe(0);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
  });
});
