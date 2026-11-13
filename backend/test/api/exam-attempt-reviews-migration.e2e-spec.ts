import { ExamAttemptReviews1756420000000 } from '../../src/migrations/1756420000000-ExamAttemptReviews';
import { createTestApp, TestApp } from '../support/test-app';

/** Attempt reviews (P8-04): the table is created safely twice, with a count check, and reverted. */
describe('ExamAttemptReviews migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates exam_attempt_reviews, safely twice, and reverts', async () => {
    const migration = new ExamAttemptReviews1756420000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () => (await runner.query(`SELECT to_regclass('public.exam_attempt_reviews') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[ExamAttemptReviews] reviews: 0');
    } finally {
      await runner.release();
    }
  });
});
