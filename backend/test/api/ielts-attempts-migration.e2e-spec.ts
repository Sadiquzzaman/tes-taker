import { IeltsAttempts1756480000000 } from '../../src/migrations/1756480000000-IeltsAttempts';
import { createTestApp, TestApp } from '../support/test-app';

/** IELTS attempts (P10-04): the three tables are created safely twice, with a count check, and reverted. */
describe('IeltsAttempts migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates ielts_assignments, ielts_attempts and ielts_answers, safely twice, and reverts', async () => {
    const migration = new IeltsAttempts1756480000000();
    const runner = t.dataSource.createQueryRunner();
    const tables = ['ielts_assignments', 'ielts_attempts', 'ielts_answers'];
    const existing = async () => (await Promise.all(tables.map((name) => runner.hasTable(name)))).filter(Boolean).length;
    try {
      await migration.down(runner);
      expect(await existing()).toBe(0);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await existing()).toBe(3);
      expect(log).toHaveBeenCalledWith('[IeltsAttempts] assignments: 0, attempts: 0, answers: 0');
    } finally {
      await runner.release();
    }
  });
});
