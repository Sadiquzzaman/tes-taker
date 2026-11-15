import { IeltsTests1756470000000 } from '../../src/migrations/1756470000000-IeltsTests';
import { createTestApp, TestApp } from '../support/test-app';

/** IELTS tests (P10-02): the four tables are created safely twice, with a count check, and reverted. */
describe('IeltsTests migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates ielts_tests, ielts_test_parts, ielts_question_groups and ielts_questions, safely twice, and reverts', async () => {
    const migration = new IeltsTests1756470000000();
    const runner = t.dataSource.createQueryRunner();
    const tables = ['ielts_tests', 'ielts_test_parts', 'ielts_question_groups', 'ielts_questions'];
    const existing = async () => (await Promise.all(tables.map((name) => runner.hasTable(name)))).filter(Boolean).length;
    try {
      await migration.down(runner);
      expect(await existing()).toBe(0);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await existing()).toBe(4);
      expect(log).toHaveBeenCalledWith('[IeltsTests] tests: 0, parts: 0, groups: 0, questions: 0');
      const fks = await runner.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE contype = 'f' AND conname LIKE 'FK_ielts_test%' OR conname LIKE 'FK_ielts_question%'`);
      expect(fks[0].n).toBe(9);
    } finally {
      await runner.release();
    }
  });
});
