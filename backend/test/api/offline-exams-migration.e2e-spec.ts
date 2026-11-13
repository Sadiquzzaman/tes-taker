import { OfflineExams1756350000000 } from '../../src/migrations/1756350000000-OfflineExams';
import { createTestApp, TestApp } from '../support/test-app';

/** Paper exams (P7-01): both tables are created safely twice, with a count check, and reverted. */
describe('OfflineExams migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates offline_exams and offline_exam_marks, safely twice, and reverts', async () => {
    const migration = new OfflineExams1756350000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async (table: string) => (await runner.query(`SELECT to_regclass('public.${table}') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect([await exists('offline_exams'), await exists('offline_exam_marks')]).toEqual([false, false]);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect([await exists('offline_exams'), await exists('offline_exam_marks')]).toEqual([true, true]);
      expect(log).toHaveBeenCalledWith('[OfflineExams] exams: 0, marks: 0');
    } finally {
      await runner.release();
    }
  });
});
