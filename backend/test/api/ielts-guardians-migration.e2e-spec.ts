import { IeltsGuardians1756540000000 } from '../../src/migrations/1756540000000-IeltsGuardians';
import { createTestApp, TestApp } from '../support/test-app';

/** Guardians on/off (P12-03): the column is made safely twice and reverted. */
describe('IeltsGuardians migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('adds org_settings.guardians_enabled, safely twice, and reverts', async () => {
    const migration = new IeltsGuardians1756540000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () =>
      (await runner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'org_settings' AND column_name = 'guardians_enabled'`)).length > 0;
    try {
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[IeltsGuardians] organisations with the switch set: 0');
    } finally {
      await runner.release();
    }
  });
});
