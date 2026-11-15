import { IeltsBandTablesService } from '../../src/ielts/ielts-band-tables.service';
import { IeltsBandTables1756460000000 } from '../../src/migrations/1756460000000-IeltsBandTables';
import { createTestApp, TestApp } from '../support/test-app';

/** IELTS band tables (P10-02): the table is created safely twice, with a count check, and reverted; the API adds the defaults. */
describe('IeltsBandTables migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates ielts_band_tables, safely twice, and reverts; the API adds the defaults once', async () => {
    const migration = new IeltsBandTables1756460000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () => (await runner.query(`SELECT to_regclass('public.ielts_band_tables') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[IeltsBandTables] defaults: 0, centre copies: 0');
      await t.app.get(IeltsBandTablesService).seedDefaults();
      await t.app.get(IeltsBandTablesService).seedDefaults();
      const defaults = await runner.query(`SELECT module, test_type FROM ielts_band_tables WHERE organization_id IS NULL ORDER BY module, test_type`);
      expect(defaults).toEqual([
        { module: 'LISTENING', test_type: null },
        { module: 'READING', test_type: 'ACADEMIC' },
        { module: 'READING', test_type: 'GENERAL' },
      ]);
      // One table per centre, module and test type: a second default is refused.
      await expect(runner.query(`INSERT INTO ielts_band_tables (module, test_type, rows) VALUES ('LISTENING', NULL, '[]')`)).rejects.toThrow();
    } finally {
      await runner.release();
    }
  });
});
