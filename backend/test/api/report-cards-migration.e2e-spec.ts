import { ReportCards1756380000000 } from '../../src/migrations/1756380000000-ReportCards';
import { createTestApp, TestApp } from '../support/test-app';

/** Report cards (P7-04): the table is created safely twice, with a count check, and reverted. */
describe('ReportCards migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates report_cards with its version index, safely twice, and reverts', async () => {
    const migration = new ReportCards1756380000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async () => (await runner.query(`SELECT to_regclass('public.report_cards') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect(await exists()).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(await exists()).toBe(true);
      expect(log).toHaveBeenCalledWith('[ReportCards] cards: 0');
      const indexes = (await runner.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'report_cards' ORDER BY 1`)).map((i: { indexname: string }) => i.indexname);
      expect(indexes).toEqual(['IDX_report_cards_section', 'PK_report_cards', 'UQ_report_cards_share_token', 'UQ_report_cards_version']);
    } finally {
      await runner.release();
    }
  });
});
