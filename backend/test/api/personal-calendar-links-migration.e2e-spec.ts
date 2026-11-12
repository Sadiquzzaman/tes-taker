import { PersonalCalendarLinks1756340000000 } from '../../src/migrations/1756340000000-PersonalCalendarLinks';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/** Personal calendar links: organization_id becomes optional, safely twice; reverting refuses while personal links exist. */
describe('PersonalCalendarLinks migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('makes organization_id optional, safely twice, and reverts only without personal links', async () => {
    const migration = new PersonalCalendarLinks1756340000000();
    const runner = t.dataSource.createQueryRunner();
    const nullable = async () =>
      (await runner.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'calendar_feed_tokens' AND column_name = 'organization_id'`))[0].is_nullable;
    const user = await factories(t.dataSource).teacher();
    try {
      await migration.up(runner);
      await migration.up(runner);
      expect(await nullable()).toBe('YES');
      await runner.query(`INSERT INTO calendar_feed_tokens (organization_id, user_id, token_hash) VALUES (NULL, $1, $2)`, [user.id, 'f'.repeat(64)]);
      await expect(migration.down(runner)).rejects.toThrow(/personal calendar links exist/);
      expect(await nullable()).toBe('YES');
      // Personal links of other suites in this shared test database would block reverting too.
      await runner.query(`DELETE FROM calendar_feed_tokens WHERE organization_id IS NULL`);
      await migration.down(runner);
      expect(await nullable()).toBe('NO');
      await migration.up(runner);
      expect(await nullable()).toBe('YES');
    } finally {
      await runner.release();
    }
  });
});
