import { ResourceLibrary1756440000000 } from '../../src/migrations/1756440000000-ResourceLibrary';
import { createTestApp, TestApp } from '../support/test-app';

/** The resource library (P9-03): its four tables are created safely twice, with a count check, and reverted. */
describe('ResourceLibrary migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates the library tables, safely twice, and reverts', async () => {
    const migration = new ResourceLibrary1756440000000();
    const runner = t.dataSource.createQueryRunner();
    const tables = ['resource_folders', 'resources', 'resource_shares', 'resource_views'];
    const exist = async () => Promise.all(tables.map(async (name) => (await runner.query(`SELECT to_regclass('public.${name}') IS NOT NULL AS e`))[0].e));
    try {
      await migration.down(runner);
      expect(await exist()).toEqual([false, false, false, false]);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exist()).toEqual([true, true, true, true]);
      expect(log).toHaveBeenCalledWith('[ResourceLibrary] folders: 0, resources: 0, shares: 0, views: 0');
    } finally {
      await runner.release();
    }
  });
});
