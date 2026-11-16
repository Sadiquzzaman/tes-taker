import { Integrity1756490000000 } from '../../src/migrations/1756490000000-Integrity';
import { createTestApp, TestApp } from '../support/test-app';

/** Plagiarism checks (P10-09): the tables and the thresholds column are added safely twice, with a count check, and reverted. */
describe('Integrity migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates similarity_checks and similarity_matches and org_settings.plagiarism_thresholds, safely twice, and reverts', async () => {
    const migration = new Integrity1756490000000();
    const runner = t.dataSource.createQueryRunner();
    const column = async () => (await runner.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'org_settings' AND column_name = 'plagiarism_thresholds'`))[0].n;
    try {
      await migration.down(runner);
      expect([await runner.hasTable('similarity_checks'), await runner.hasTable('similarity_matches'), await column()]).toEqual([false, false, 0]);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect([await runner.hasTable('similarity_checks'), await runner.hasTable('similarity_matches'), await column()]).toEqual([true, true, 1]);
      expect(log).toHaveBeenCalledWith('[Integrity] checks: 0, matches: 0');
    } finally {
      await runner.release();
    }
  });
});
