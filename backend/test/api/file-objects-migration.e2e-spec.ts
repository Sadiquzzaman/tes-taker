import { FileObjects1755800000000 } from '../../src/migrations/1755800000000-FileObjects';
import { Homework1756270000000 } from '../../src/migrations/1756270000000-Homework';
import { HomeworkSubmissions1756280000000 } from '../../src/migrations/1756280000000-HomeworkSubmissions';
import { LeaveRequests1756250000000 } from '../../src/migrations/1756250000000-LeaveRequests';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Migration FileObjects (P2-07): a new table only. It can be reverted, and running it twice
 * leaves one table with its indexes and foreign keys. P3-06's leave_requests points at file_objects,
 * so LeaveRequests goes down first and comes back last.
 */
describe('FileObjects migration', () => {
  let t: TestApp;
  const migration = new FileObjects1755800000000();
  const leaveRequests = new LeaveRequests1756250000000();
  const homework = new Homework1756270000000();
  const submissions = new HomeworkSubmissions1756280000000();

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  const count = async (sql: string) => Number(((await t.dataSource.query(sql)) as Array<{ n: string }>)[0].n);

  it('reverts, then runs twice without errors or duplicates', async () => {
    const runner = t.dataSource.createQueryRunner();
    try {
      // Homework attachments point at file_objects: down first, back last.
      await submissions.down(runner);
      await homework.down(runner);
      await leaveRequests.down(runner);
      await migration.down(runner);
      expect(await runner.hasTable('file_objects')).toBe(false);

      await migration.up(runner);
      await migration.up(runner);

      expect(await runner.hasTable('file_objects')).toBe(true);
      expect(await count(`SELECT COUNT(*) AS n FROM pg_indexes WHERE tablename = 'file_objects'`)).toBe(5);
      expect(
        await count(`SELECT COUNT(*) AS n FROM pg_constraint WHERE conrelid = 'file_objects'::regclass AND contype = 'f'`),
      ).toBe(3);
      expect(console.log).toHaveBeenCalledWith('[FileObjects] file_objects rows: 0');
      await leaveRequests.up(runner);
      await homework.up(runner);
      await submissions.up(runner);
    } finally {
      await runner.release();
    }
  });
});
