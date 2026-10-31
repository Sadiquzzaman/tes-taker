import { MigrationInterface, QueryRunner } from 'typeorm';

/** Live guardian rows (removed ones keep deleted_at and deleted_by). */
const LIVE = `"deleted_at" IS NULL`;

/**
 * Guardians (P2-05, FND-09) and the guardian SMS language (FND-10).
 *
 * Expand only: a new `guardians` table (up to 2 per student per organisation, one primary; an
 * invited student without an account is reached through `enrolment_id`), and a nullable
 * `org_settings.sms_locale` (null = the organisation's default language). Guardians are never
 * hard-deleted: partial unique indexes ignore removed rows. No existing data is changed.
 * Safe to run twice; logs a count check.
 */
export class Guardians1755600000000 implements MigrationInterface {
  name = 'Guardians1755600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createType(queryRunner, 'guardians_is_active_enum', `'1', '0'`);
    await this.createType(queryRunner, 'guardian_relation', `'FATHER', 'MOTHER', 'OTHER'`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guardians" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" "public"."guardians_is_active_enum" NOT NULL DEFAULT '1',
        "created_by" uuid, "created_user_name" character varying(100),
        "updated_by" uuid, "updated_user_name" character varying(100),
        "created_at" TIMESTAMP, "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL, "student_id" uuid, "enrolment_id" uuid,
        "name" character varying(120) NOT NULL, "relation" "public"."guardian_relation" NOT NULL,
        "phone" character varying(14) NOT NULL, "is_primary" boolean NOT NULL DEFAULT false,
        "sms_locale" character varying(5),
        "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid,
        CONSTRAINT "CHK_guardians_sms_locale" CHECK ("sms_locale" IS NULL OR "sms_locale" IN ('bn', 'en')),
        CONSTRAINT "CHK_guardians_student_or_enrolment" CHECK ("student_id" IS NOT NULL OR "enrolment_id" IS NOT NULL),
        CONSTRAINT "PK_3dcf02f3dc96a2c017106f280be" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_guardians_enrolment" ON "guardians" ("enrolment_id")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_guardians_enrolment_primary" ON "guardians" ("organization_id", "enrolment_id")
      WHERE ${LIVE} AND "is_primary" AND "student_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_guardians_student_primary" ON "guardians" ("organization_id", "student_id")
      WHERE ${LIVE} AND "is_primary" AND "student_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_guardians_enrolment_phone" ON "guardians" ("organization_id", "enrolment_id", "phone")
      WHERE ${LIVE} AND "student_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_guardians_student_phone" ON "guardians" ("organization_id", "student_id", "phone")
      WHERE ${LIVE} AND "student_id" IS NOT NULL
    `);
    await this.addConstraint(queryRunner, 'guardians', 'FK_69e793368dac6279adfd6ca55ad',
      `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'guardians', 'FK_ed371de66d86d81bd9fa168fbf0',
      `FOREIGN KEY ("enrolment_id") REFERENCES "enrolments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`ALTER TABLE "org_settings" ADD COLUMN IF NOT EXISTS "sms_locale" character varying(5)`);
    await this.addConstraint(queryRunner, 'org_settings', 'CHK_org_settings_sms_locale',
      `CHECK ("sms_locale" IS NULL OR "sms_locale" IN ('bn', 'en'))`);

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM guardians) AS guardians,
        (SELECT count(*)::int FROM org_settings WHERE sms_locale IS NOT NULL) AS sms_locale_set
    `);
    console.log(`[Guardians] guardians: ${counts.guardians}, organisations with an SMS language set: ${counts.sms_locale_set}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_settings" DROP CONSTRAINT IF EXISTS "CHK_org_settings_sms_locale"`);
    await queryRunner.query(`ALTER TABLE "org_settings" DROP COLUMN IF EXISTS "sms_locale"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guardians"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."guardian_relation"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."guardians_is_active_enum"`);
  }

  private async createType(queryRunner: QueryRunner, name: string, values: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."${name}" AS ENUM(${values});
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
  }

  private async addConstraint(queryRunner: QueryRunner, table: string, name: string, definition: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$;
    `);
  }
}
