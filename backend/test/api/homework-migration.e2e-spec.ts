import { Homework1756270000000 } from '../../src/migrations/1756270000000-Homework';
import { HomeworkSubmissions1756280000000 } from '../../src/migrations/1756280000000-HomeworkSubmissions';
import { createTestApp, TestApp } from '../support/test-app';

/** Homework tables (P5-01): created empty, safely twice, with a count check, and reverted. */
describe('Homework migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates the homework tables, safely twice, and reverts', async () => {
    const migration = new Homework1756270000000();
    // Hand-ins (P5-02) point at homework: down first, back last.
    const submissions = new HomeworkSubmissions1756280000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      const tables = async () =>
        (
          await runner.query(
            `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('homework', 'homework_targets', 'homework_attachments')`,
          )
        )[0].n;

      await submissions.down(runner);
      await migration.down(runner);
      expect(await tables()).toBe(0);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await tables()).toBe(3);
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[Homework\] homework: \d+, targets: \d+, attachments: \d+$/));

      await migration.down(runner);
      expect(await tables()).toBe(0);
      await migration.up(runner);
      await submissions.up(runner);
    } finally {
      await runner.release();
    }
  });
});
