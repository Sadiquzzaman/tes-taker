import { BehaviourRatings1756360000000 } from '../../src/migrations/1756360000000-BehaviourRatings';
import { createTestApp, TestApp } from '../support/test-app';

/** Behaviour ratings (P7-01): both tables are created safely twice, with a count check, and reverted. */
describe('BehaviourRatings migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates behaviour_criteria and behaviour_ratings, safely twice, and reverts', async () => {
    const migration = new BehaviourRatings1756360000000();
    const runner = t.dataSource.createQueryRunner();
    const exists = async (table: string) => (await runner.query(`SELECT to_regclass('public.${table}') IS NOT NULL AS e`))[0].e;
    try {
      await migration.down(runner);
      expect([await exists('behaviour_criteria'), await exists('behaviour_ratings')]).toEqual([false, false]);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect([await exists('behaviour_criteria'), await exists('behaviour_ratings')]).toEqual([true, true]);
      expect(log).toHaveBeenCalledWith('[BehaviourRatings] criteria: 0, ratings: 0');
    } finally {
      await runner.release();
    }
  });
});
