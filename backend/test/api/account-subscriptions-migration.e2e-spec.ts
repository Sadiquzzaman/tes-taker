import { AccountSubscriptions1755300000000 } from '../../src/migrations/1755300000000-AccountSubscriptions';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Row = Record<string, unknown>;

/**
 * Migration M2 part 2 (P2-02) on data shaped like beta before the change: teacher subscriptions
 * (one active with an override, one waiting for payment), a payment that only knows its teacher
 * through metadata, and a school with no plan. Run twice, it must move each plan to the
 * teacher's SOLO organisation, start the school on Pro once, and change nothing the second time.
 */
describe('AccountSubscriptions migration', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  const migration = new AccountSubscriptions1755300000000();

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  const query = <T = Row>(sql: string, params: unknown[] = []) => t.dataSource.query(sql, params) as Promise<T[]>;

  it('moves plans to organisations and gives schools Pro, once', async () => {
    const runner = t.dataSource.createQueryRunner();
    try {
      // Back to the schema before P2-02, then add old-style data.
      await migration.down(runner);

      const soloTeacher = await make.teacher();
      const solo = await make.soloOrganization(soloTeacher);
      const orgOnlyOwner = await make.teacher({ personal_teacher_enabled: false });
      const school = await make.organization(orgOnlyOwner);
      const [free] = await query<{ id: string }>(`SELECT id FROM subscription_plans WHERE slug = 'free'`);
      const [pro] = await query<{ id: string }>(`SELECT id FROM subscription_plans WHERE slug = 'pro'`);

      const [active] = await query<{ id: string }>(
        `INSERT INTO teacher_subscriptions (teacher_id, plan_id, amount_paid, status, start_date, overrides, created_at)
         VALUES ($1, $2, 0, 'ACTIVE', now(), $3, now()) RETURNING id`,
        [soloTeacher.id, free.id, JSON.stringify({ features: { allow_model_tests: true }, limits: { max_total_exams: 10 } })],
      );
      const [pending] = await query<{ id: string }>(
        `INSERT INTO teacher_subscriptions (teacher_id, plan_id, billing_cycle, amount_paid, status, start_date, created_at)
         VALUES ($1, $2, 'MONTHLY', 499, 'PENDING', now(), now()) RETURNING id`,
        [orgOnlyOwner.id, pro.id],
      );
      await query(
        `INSERT INTO payments (order_id, transaction_id, amount, currency, status, metadata)
         VALUES ('SUB_1', 'TT_MIGRATION_1', 499, 'BDT', 'PENDING', $1)`,
        [JSON.stringify({ teacherId: orgOnlyOwner.id, subscriptionId: pending.id })],
      );

      await migration.up(runner);
      await migration.up(runner);

      // The solo teacher's plan is on their SOLO organisation, with the override moved over.
      const [activeRow] = await query(`SELECT organization_id, status FROM account_subscriptions WHERE id = $1`, [active.id]);
      expect(activeRow).toMatchObject({ organization_id: solo.id, status: 'ACTIVE' });
      const overrides = await query<{ key: string; value: unknown }>(
        `SELECT key, value FROM feature_overrides WHERE organization_id = $1 ORDER BY key`,
        [solo.id],
      );
      expect(overrides).toEqual([
        { key: 'allow_model_tests', value: true },
        { key: 'max_total_exams', value: 10 },
      ]);

      // A teacher without a SOLO organisation gets one for their plan; the unpaid price is price_due.
      const [pendingRow] = await query<{ organization_id: string; price_due: string; amount_paid: string }>(
        `SELECT s.organization_id, s.price_due, s.amount_paid FROM account_subscriptions s WHERE s.id = $1`,
        [pending.id],
      );
      const [ownerSolo] = await query<{ kind: string }>(`SELECT kind FROM organizations WHERE id = $1`, [pendingRow.organization_id]);
      expect(ownerSolo.kind).toBe(OrganizationKindEnum.SOLO);
      expect(Number(pendingRow.price_due)).toBe(499);
      expect(Number(pendingRow.amount_paid)).toBe(0);

      // The school starts on Pro, once.
      const schoolPlans = await query<{ slug: string }>(
        `SELECT p.slug FROM account_subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.organization_id = $1 AND s.status = 'ACTIVE'`,
        [school.id],
      );
      expect(schoolPlans).toEqual([{ slug: 'pro' }]);

      // The payment knows who paid, for which subscription and organisation.
      const [payment] = await query(`SELECT user_id, subscription_id, organization_id, purpose FROM payments WHERE transaction_id = 'TT_MIGRATION_1'`);
      expect(payment).toEqual({
        user_id: orgOnlyOwner.id,
        subscription_id: pending.id,
        organization_id: pendingRow.organization_id,
        purpose: 'SUBSCRIPTION',
      });

      const [{ left }] = await query<{ left: string }>(`SELECT COUNT(*) AS left FROM account_subscriptions WHERE organization_id IS NULL`);
      expect(Number(left)).toBe(0);
    } finally {
      await runner.release();
    }
  });
});
