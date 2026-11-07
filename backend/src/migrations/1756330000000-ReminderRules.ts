import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reminder rules (P5-05 part 4, CAL-05; design §9.9). Creates `reminder_rules`: per organisation
 * a default per kind (class, exam, event) and each person's own, as a list of up to 5 times before
 * the start with a channel. A CHECK keeps `target` to the known kinds.
 *
 * A new empty table; no existing row changes. Safe to run twice; logs a count check.
 */
export class ReminderRules1756330000000 implements MigrationInterface {
  name = 'ReminderRules1756330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reminder_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid,
        "target" character varying(10) NOT NULL,
        "offsets" jsonb NOT NULL,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reminder_rules" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_reminder_rules_target" CHECK ("target" IN ('CLASS', 'EXAM', 'EVENT'))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reminder_rules_org_default" ON "reminder_rules" ("organization_id", "target") WHERE "user_id" IS NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reminder_rules_user" ON "reminder_rules" ("organization_id", "user_id", "target") WHERE "user_id" IS NOT NULL`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_reminder_rules_user') THEN
          ALTER TABLE "reminder_rules" ADD CONSTRAINT "FK_reminder_rules_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    const [counts] = await queryRunner.query(`SELECT count(*)::int AS rules FROM reminder_rules`);
    console.log(`[ReminderRules] rules: ${counts.rules}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reminder_rules"`);
  }
}
