import { RefreshTokens1756510000000 } from '../../src/migrations/1756510000000-RefreshTokens';
import { createTestApp, TestApp } from '../support/test-app';

/** Signed-in devices (PM-01): the table is created safely twice, with a count check, and reverted. */
describe('RefreshTokens migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates refresh_tokens, safely twice, and reverts', async () => {
    const migration = new RefreshTokens1756510000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () => (await runner.query(`SELECT to_regclass('public.refresh_tokens') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[RefreshTokens] tokens: 0');
      const constraints = await runner.query(
        `SELECT conname FROM pg_constraint WHERE conrelid = 'refresh_tokens'::regclass ORDER BY conname`,
      );
      expect(constraints.map((c: { conname: string }) => c.conname)).toEqual([
        'CHK_refresh_tokens_platform',
        'FK_refresh_tokens_user',
        'PK_refresh_tokens',
      ]);
    } finally {
      await runner.release();
    }
  });
});
