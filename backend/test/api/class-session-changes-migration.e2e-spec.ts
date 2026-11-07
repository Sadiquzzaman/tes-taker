import { ClassSessionChanges1756300000000 } from '../../src/migrations/1756300000000-ClassSessionChanges';
import { createTestApp, TestApp } from '../support/test-app';

/** One-day change columns on class_attendance (P5-04 part 3): added safely twice, with a count check, and reverted. */
describe('ClassSessionChanges migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('adds the substitute and change columns, safely twice, and reverts', async () => {
    const migration = new ClassSessionChanges1756300000000();
    const runner = t.dataSource.createQueryRunner();
    const columns = async () =>
      (
        await runner.query(
          `SELECT count(*)::int AS n FROM information_schema.columns
           WHERE table_name = 'class_attendance' AND column_name IN ('substitute_teacher_id', 'changed_at', 'changed_by', 'change_note')`,
        )
      )[0].n;
    try {
      await migration.down(runner);
      await migration.down(runner);
      expect(await columns()).toBe(0);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await columns()).toBe(4);
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[ClassSessionChanges\] class sessions: \d+, changed for a day: 0$/));
    } finally {
      await runner.release();
    }
  });
});
