import { IeltsProfiles1756450000000 } from '../../src/migrations/1756450000000-IeltsProfiles';
import { createTestApp, TestApp } from '../support/test-app';

/** IELTS profiles (P10-01): the table is created safely twice, with a count check, and reverted. */
describe('IeltsProfiles migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates ielts_profiles, safely twice, and reverts', async () => {
    const migration = new IeltsProfiles1756450000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () => (await runner.query(`SELECT to_regclass('public.ielts_profiles') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[IeltsProfiles] profiles: 0');
    } finally {
      await runner.release();
    }
  });
});
