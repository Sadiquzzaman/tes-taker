import { ScoreWeights1756370000000 } from '../../src/migrations/1756370000000-ScoreWeights';
import { createTestApp, TestApp } from '../support/test-app';

/** Score weights (P7-02): the table and the org_settings columns are added safely twice, with a count check, and reverted. */
describe('ScoreWeights migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates score_weights and the performance settings with their defaults, safely twice, and reverts', async () => {
    const migration = new ScoreWeights1756370000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () => (await runner.query(`SELECT to_regclass('public.score_weights') IS NOT NULL AS e`))[0].e;
    const columns = async () =>
      (
        await runner.query(
          `SELECT column_name, column_default FROM information_schema.columns
            WHERE table_name = 'org_settings' AND column_name IN ('at_risk_score_pct', 'at_risk_attendance_pct', 'at_risk_missing_homework', 'show_rank') ORDER BY column_name`,
        )
      ).map((c: { column_name: string; column_default: string }) => [c.column_name, c.column_default]);
    try {
      await migration.down(runner);
      expect([await exists(), await columns()]).toEqual([false, []]);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(await columns()).toEqual([
        ['at_risk_attendance_pct', '75'],
        ['at_risk_missing_homework', '3'],
        ['at_risk_score_pct', '40'],
        ['show_rank', 'false'],
      ]);
      expect(log).toHaveBeenCalledWith('[ScoreWeights] weights: 0, showing rank: 0');
      await expect(
        runner.query(`INSERT INTO score_weights (organization_id, session_id, class_id, exams_pct, homework_pct, attendance_pct, behaviour_pct) VALUES (uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(), 50, 20, 20, 20)`),
      ).rejects.toThrow();
    } finally {
      await runner.release();
    }
  });
});
