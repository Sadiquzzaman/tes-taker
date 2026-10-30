import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SMS credits (P2-08 part 2, FND-13, design §8.6): every grant, expiry, top-up, send and refund of
 * an organisation's SMS credits, per bucket (ALLOWANCE expires monthly, TOPUP carries over).
 *
 * New table only, no data moved: each organisation's first month is granted when its credits are
 * first used (or by the hourly billing.sms-allowance job). The plans' `sms_credits_per_month` limit
 * is added by the API at start-up where a preset plan has none. Safe to run twice.
 */
export class SmsCreditLedger1755910000000 implements MigrationInterface {
  name = 'SmsCreditLedger1755910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_credit_ledger" (
        "id" BIGSERIAL NOT NULL,
        "organization_id" uuid NOT NULL,
        "bucket" character varying(10) NOT NULL,
        "reason" character varying(20) NOT NULL,
        "delta" integer NOT NULL,
        "balance_after" integer NOT NULL,
        "period" character varying(7),
        "outbox_id" uuid,
        "payment_id" uuid,
        "note" text,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_sms_credit_ledger_reason" CHECK ("reason" IN ('MONTHLY_GRANT', 'MONTHLY_EXPIRE', 'TOPUP', 'SEND', 'REFUND', 'ADJUST')),
        CONSTRAINT "CHK_sms_credit_ledger_bucket" CHECK ("bucket" IN ('ALLOWANCE', 'TOPUP')),
        CONSTRAINT "PK_06fb94a2350252c884d5b2e338f" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sms_credit_ledger_payment" ON "sms_credit_ledger" ("payment_id") WHERE "payment_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sms_credit_ledger_outbox" ON "sms_credit_ledger" ("outbox_id", "bucket", "reason") WHERE "outbox_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sms_credit_ledger_period" ON "sms_credit_ledger" ("organization_id", "bucket", "reason", "period") WHERE "period" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sms_credit_ledger_organization_bucket" ON "sms_credit_ledger" ("organization_id", "bucket", "id")`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_314d4f854c70220d8ad1d737bc7') THEN
          ALTER TABLE "sms_credit_ledger" ADD CONSTRAINT "FK_314d4f854c70220d8ad1d737bc7"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_2384e71b2f2f797ff3da2d3a79f') THEN
          ALTER TABLE "sms_credit_ledger" ADD CONSTRAINT "FK_2384e71b2f2f797ff3da2d3a79f"
            FOREIGN KEY ("outbox_id") REFERENCES "notification_outbox"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_eb4bfb19bb1c4af8538de16692f') THEN
          ALTER TABLE "sms_credit_ledger" ADD CONSTRAINT "FK_eb4bfb19bb1c4af8538de16692f"
            FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_credit_ledger"`);
  }
}
