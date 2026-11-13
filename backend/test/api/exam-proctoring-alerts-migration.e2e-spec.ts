import { ExamProctoringAlerts1756410000000 } from '../../src/migrations/1756410000000-ExamProctoringAlerts';
import { createTestApp, TestApp } from '../support/test-app';

/** Proctoring alerts (P8-03): `exams.alert_flags` is added (null = no alerts) safely twice, and reverted. */
describe('ExamProctoringAlerts migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('adds alert_flags with its range, safely twice, and reverts', async () => {
    const migration = new ExamProctoringAlerts1756410000000();
    const runner = t.dataSource.createQueryRunner();
    const column = async () =>
      (await runner.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'alert_flags'`))[0].n;
    try {
      await migration.down(runner);
      expect(await column()).toBe(0);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await column()).toBe(1);
      expect(log).toHaveBeenCalledWith('[ExamProctoringAlerts] exams with alerts: 0');
      expect((await runner.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'CHK_exams_alert_flags'`))[0].n).toBe(1);
    } finally {
      await runner.release();
    }
  });
});
