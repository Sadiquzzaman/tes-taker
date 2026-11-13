import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { ExamProctoringSettings1756390000000 } from '../../src/migrations/1756390000000-ExamProctoringSettings';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/** Proctoring settings (P8-01): exams that existed keep Strict and auto-disqualify at 15, once; reverted cleanly. */
describe('ExamProctoringSettings migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('keeps existing exams as they were (Strict, auto-disqualify at 15), safely twice, and reverts', async () => {
    const make = factories(t.dataSource);
    const teacher = await make.teacher();
    const migration = new ExamProctoringSettings1756390000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      await migration.down(runner);
      const exam = await runner.query(`INSERT INTO exams (created_by, test_name) VALUES ($1, 'Old quiz') RETURNING id`, [teacher.id]);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      expect(await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id: exam[0].id })).toMatchObject({
        proctoring_level: 'STRICT',
        proctoring_checks_off: [],
        auto_disqualify: true,
        disqualify_threshold: 15,
        disqualify_checks: null,
      });
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[ExamProctoringSettings\] exams: \d+, auto-disqualify on: \d+$/));
      // A second run does not turn auto-disqualify back on for exams changed since.
      await runner.query(`UPDATE exams SET auto_disqualify = false WHERE id = $1`, [exam[0].id]);
      await migration.up(runner);
      expect((await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id: exam[0].id })).auto_disqualify).toBe(false);
      await expect(runner.query(`UPDATE exams SET proctoring_level = 'MAX' WHERE id = $1`, [exam[0].id])).rejects.toThrow();
    } finally {
      await runner.release();
    }
  });
});
