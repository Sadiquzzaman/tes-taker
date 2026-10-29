import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Account subscriptions (P2-02, FND-07/08, design §8.3 and migration step M2).
 *
 * A plan now belongs to an organisation: teacher_subscriptions is renamed to account_subscriptions
 * (so payment_history's foreign key keeps working) and gets organization_id and price_due. Each
 * teacher's rows move to their SOLO organisation. Existing schools start on Pro with no end date
 * (owner decision), until a platform admin assigns another plan. Overrides move to
 * feature_overrides; payments learn their organisation, payer, subscription and purpose.
 *
 * Expand + migrate: teacher_id, overrides and the old usage counters stay for one release.
 * Safe to run twice; logs a count check.
 */
export class AccountSubscriptions1755300000000 implements MigrationInterface {
  name = 'AccountSubscriptions1755300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. teacher_subscriptions -> account_subscriptions (table, its enum types and constraints).
    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.teacher_subscriptions') IS NOT NULL AND to_regclass('public.account_subscriptions') IS NULL THEN
          ALTER TABLE "teacher_subscriptions" RENAME TO "account_subscriptions";
          ALTER TYPE "public"."teacher_subscriptions_is_active_enum" RENAME TO "account_subscriptions_is_active_enum";
          ALTER TYPE "public"."teacher_subscriptions_billing_cycle_enum" RENAME TO "account_subscriptions_billing_cycle_enum";
          ALTER TYPE "public"."teacher_subscriptions_status_enum" RENAME TO "account_subscriptions_status_enum";
          ALTER TABLE "account_subscriptions" RENAME CONSTRAINT "PK_9b99457823062e3bedd461b31ab" TO "PK_83a2cc0a3f89e9085f741552db1";
          ALTER TABLE "account_subscriptions" DROP CONSTRAINT "FK_8965d466613a0a12098d1ba3e1e";
          ALTER TABLE "account_subscriptions" DROP CONSTRAINT "FK_ba8738ee3856ee3b130c0b1e040";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "account_subscriptions"
        ADD COLUMN IF NOT EXISTS "organization_id" uuid,
        ADD COLUMN IF NOT EXISTS "price_due" numeric(10,2) NOT NULL DEFAULT '0',
        ALTER COLUMN "teacher_id" DROP NOT NULL
    `);

    const before = await this.counts(queryRunner);

    // 2. Every subscription holder gets a SOLO organisation if they have none (teachers whose
    //    personal teaching was off did not get one in P2-01).
    await queryRunner.query(`
      WITH holders AS (
        SELECT DISTINCT u.id, u.full_name
        FROM account_subscriptions s JOIN users u ON u.id = s.teacher_id
        WHERE s.organization_id IS NULL
      ),
      missing AS (
        SELECT gen_random_uuid() AS organization_id, h.id AS user_id,
               COALESCE(NULLIF(TRIM(h.full_name), ''), 'My Teaching') AS name
        FROM holders h
        WHERE NOT EXISTS (
          SELECT 1 FROM organization_members m JOIN organizations o ON o.id = m.organization_id
          WHERE m.user_id = h.id AND m.role = 'OWNER' AND o.kind = 'SOLO'
        )
      ),
      created AS (
        INSERT INTO organizations (id, name, status, kind, created_by, created_user_name, created_at, is_active)
        SELECT organization_id, LEFT(name, 200), 'approved', 'SOLO', user_id, LEFT(name, 100), now(), '1' FROM missing
        RETURNING id, created_by, created_user_name
      )
      INSERT INTO organization_members (organization_id, user_id, role, created_by, created_user_name, created_at, is_active)
      SELECT id, created_by, 'OWNER', created_by, created_user_name, now(), '1' FROM created
    `);

    // 3. A teacher's subscriptions belong to their SOLO organisation.
    await queryRunner.query(`
      UPDATE account_subscriptions s SET organization_id = m.organization_id
      FROM organization_members m JOIN organizations o ON o.id = m.organization_id AND o.kind = 'SOLO'
      WHERE s.organization_id IS NULL AND m.user_id = s.teacher_id AND m.role = 'OWNER'
    `);
    // The price used to live in amount_paid even while unpaid: keep it as price_due.
    await queryRunner.query(`UPDATE account_subscriptions SET price_due = amount_paid WHERE price_due = 0 AND amount_paid > 0`);
    await queryRunner.query(`UPDATE account_subscriptions SET amount_paid = 0 WHERE status = 'PENDING' AND amount_paid > 0`);
    // No row can be left without an organisation (teacher_id was NOT NULL with ON DELETE CASCADE);
    // if one were, SET NOT NULL below stops the migration instead of guessing.

    // 4. Existing schools start on Pro with no end date, unless they already have an active plan.
    await queryRunner.query(`
      INSERT INTO account_subscriptions (organization_id, plan_id, price_due, amount_paid, status, start_date, created_user_name, created_at, is_active)
      SELECT o.id, p.id, 0, 0, 'ACTIVE', now(), 'Migration P2-02', now(), '1'
      FROM organizations o
      CROSS JOIN (SELECT id FROM subscription_plans WHERE slug = 'pro' LIMIT 1) p
      WHERE o.kind <> 'SOLO'
        AND NOT EXISTS (SELECT 1 FROM account_subscriptions s WHERE s.organization_id = o.id AND s.status = 'ACTIVE')
    `);

    await queryRunner.query(`ALTER TABLE "account_subscriptions" ALTER COLUMN "organization_id" SET NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_86ecaaac43a22b1bc37b301703" ON "account_subscriptions" ("organization_id", "status")`);
    await this.addConstraint(queryRunner, 'account_subscriptions', 'FK_835b9b93b0eb9d5f7a9b08a516f',
      `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'account_subscriptions', 'FK_1eccdf287b700d1dc38c3b9d39c',
      `FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'account_subscriptions', 'FK_3b3dc49da89f50bc5cc86b6ae55',
      `FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    // 5. Per-organisation switches (FND-07) and "Request this feature" (FND-08).
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."feature_overrides_is_active_enum" AS ENUM('1', '0');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feature_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" "public"."feature_overrides_is_active_enum" NOT NULL DEFAULT '1',
        "created_by" uuid, "created_user_name" character varying(100),
        "updated_by" uuid, "updated_user_name" character varying(100),
        "created_at" TIMESTAMP, "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL, "key" character varying(80) NOT NULL, "value" jsonb NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE, "reason" text, "granted_by" uuid,
        CONSTRAINT "PK_e9189c6ff53758cccee04aed045" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_aafc783232432fd9d7818a750e" ON "feature_overrides" ("organization_id", "key")`);
    await this.addConstraint(queryRunner, 'feature_overrides', 'FK_33a3cb73ca215c7164546d04733',
      `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."feature_requests_is_active_enum" AS ENUM('1', '0');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."feature_requests_status_enum" AS ENUM('OPEN', 'HANDLED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feature_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" "public"."feature_requests_is_active_enum" NOT NULL DEFAULT '1',
        "created_by" uuid, "created_user_name" character varying(100),
        "updated_by" uuid, "updated_user_name" character varying(100),
        "created_at" TIMESTAMP, "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "feature_key" character varying(80) NOT NULL,
        "note" text, "status" "public"."feature_requests_status_enum" NOT NULL DEFAULT 'OPEN',
        "handled_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_f5741ccd82f3784d78f94fb57e6" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_6a670b670172233950e7ba3a34" ON "feature_requests" ("status", "created_at")`);
    await this.addConstraint(queryRunner, 'feature_requests', 'FK_483cff9b15c5b180275e3228f47',
      `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'feature_requests', 'FK_0a4cf41c69e9955f67e1b3c6806',
      `FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    // Old per-subscription overrides (active ones only) become one row per key.
    await queryRunner.query(`
      INSERT INTO feature_overrides (organization_id, key, value, expires_at, reason, created_user_name, created_at)
      SELECT s.organization_id, kv.key, kv.value,
             NULLIF(s.overrides->>'expires_at', '')::timestamptz, 'Moved from teacher_subscriptions.overrides', 'Migration P2-02', now()
      FROM account_subscriptions s
      CROSS JOIN LATERAL (
        SELECT key, value FROM jsonb_each(COALESCE(s.overrides->'features', '{}'::jsonb))
        UNION ALL
        SELECT key, value FROM jsonb_each(COALESCE(s.overrides->'limits', '{}'::jsonb))
      ) kv
      WHERE s.status = 'ACTIVE' AND s.overrides IS NOT NULL
      ON CONFLICT ("organization_id", "key") DO NOTHING
    `);

    // 6. Payments: who paid, for which organisation and subscription, and why.
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "organization_id" uuid,
        ADD COLUMN IF NOT EXISTS "user_id" uuid,
        ADD COLUMN IF NOT EXISTS "subscription_id" uuid,
        ADD COLUMN IF NOT EXISTS "purpose" character varying(30)
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fc07ace491143726974991711f" ON "payments" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_427785468fb7d2733f59e7d7d3" ON "payments" ("user_id")`);
    const uuid = `'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`;
    await queryRunner.query(`
      UPDATE payments p SET
        user_id = COALESCE(p.user_id, CASE WHEN p.metadata->>'teacherId' ~* ${uuid} THEN (p.metadata->>'teacherId')::uuid END),
        subscription_id = COALESCE(p.subscription_id, CASE WHEN p.metadata->>'subscriptionId' ~* ${uuid} THEN (p.metadata->>'subscriptionId')::uuid END),
        purpose = COALESCE(p.purpose, 'SUBSCRIPTION')
      WHERE p.user_id IS NULL OR p.subscription_id IS NULL OR p.purpose IS NULL
    `);
    await queryRunner.query(`
      UPDATE payments p SET organization_id = s.organization_id
      FROM account_subscriptions s WHERE p.organization_id IS NULL AND s.id = p.subscription_id
    `);
    await queryRunner.query(`ALTER TABLE "payment_history" ADD COLUMN IF NOT EXISTS "organization_id" uuid`);
    await queryRunner.query(`
      UPDATE payment_history h SET organization_id = s.organization_id
      FROM account_subscriptions s WHERE h.organization_id IS NULL AND s.id = h.subscription_id
    `);

    const after = await this.counts(queryRunner);
    console.log('[AccountSubscriptions] before -> after:', before, '->', after);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment_history" DROP COLUMN IF EXISTS "organization_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_427785468fb7d2733f59e7d7d3"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_fc07ace491143726974991711f"`);
    await queryRunner.query(`
      ALTER TABLE "payments"
        DROP COLUMN IF EXISTS "purpose", DROP COLUMN IF EXISTS "subscription_id",
        DROP COLUMN IF EXISTS "user_id", DROP COLUMN IF EXISTS "organization_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."feature_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."feature_requests_is_active_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_overrides"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."feature_overrides_is_active_enum"`);

    // Back to teacher subscriptions: the school plans added above go, and the rest keep their teacher.
    await queryRunner.query(`DELETE FROM account_subscriptions WHERE teacher_id IS NULL`);
    await queryRunner.query(`UPDATE account_subscriptions SET amount_paid = price_due WHERE status = 'PENDING'`);
    await queryRunner.query(`ALTER TABLE "account_subscriptions" DROP CONSTRAINT IF EXISTS "FK_3b3dc49da89f50bc5cc86b6ae55"`);
    await queryRunner.query(`ALTER TABLE "account_subscriptions" DROP CONSTRAINT IF EXISTS "FK_1eccdf287b700d1dc38c3b9d39c"`);
    await queryRunner.query(`ALTER TABLE "account_subscriptions" DROP CONSTRAINT IF EXISTS "FK_835b9b93b0eb9d5f7a9b08a516f"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_86ecaaac43a22b1bc37b301703"`);
    await queryRunner.query(`
      ALTER TABLE "account_subscriptions"
        DROP COLUMN IF EXISTS "price_due", DROP COLUMN IF EXISTS "organization_id",
        ALTER COLUMN "teacher_id" SET NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE "account_subscriptions" RENAME CONSTRAINT "PK_83a2cc0a3f89e9085f741552db1" TO "PK_9b99457823062e3bedd461b31ab"`);
    await queryRunner.query(`ALTER TYPE "public"."account_subscriptions_status_enum" RENAME TO "teacher_subscriptions_status_enum"`);
    await queryRunner.query(`ALTER TYPE "public"."account_subscriptions_billing_cycle_enum" RENAME TO "teacher_subscriptions_billing_cycle_enum"`);
    await queryRunner.query(`ALTER TYPE "public"."account_subscriptions_is_active_enum" RENAME TO "teacher_subscriptions_is_active_enum"`);
    await queryRunner.query(`ALTER TABLE "account_subscriptions" RENAME TO "teacher_subscriptions"`);
    await queryRunner.query(`
      ALTER TABLE "teacher_subscriptions" ADD CONSTRAINT "FK_8965d466613a0a12098d1ba3e1e"
        FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_subscriptions" ADD CONSTRAINT "FK_ba8738ee3856ee3b130c0b1e040"
        FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  private async addConstraint(queryRunner: QueryRunner, table: string, name: string, definition: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
  }

  private async counts(queryRunner: QueryRunner): Promise<Record<string, number>> {
    const [row] = await queryRunner.query(`
      SELECT
        (SELECT COUNT(*) FROM account_subscriptions)::int AS subscriptions,
        (SELECT COUNT(*) FROM account_subscriptions WHERE organization_id IS NULL)::int AS subscriptions_without_org,
        (SELECT COUNT(*) FROM account_subscriptions s JOIN organizations o ON o.id = s.organization_id AND o.kind <> 'SOLO' WHERE s.status = 'ACTIVE')::int AS active_school_plans,
        (SELECT COUNT(*) FROM organizations WHERE kind = 'SOLO')::int AS solo_organizations
    `);
    const [hasPaymentOrg] = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'organization_id'`,
    );
    if (hasPaymentOrg) {
      const [payments] = await queryRunner.query(`SELECT COUNT(*)::int AS n FROM payments WHERE organization_id IS NULL`);
      row.payments_without_org = payments.n;
    }
    return row;
  }
}
