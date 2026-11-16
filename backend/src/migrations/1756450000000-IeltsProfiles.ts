import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IELTS student profiles (P10-01, IEL-02). Owned by the ielts module.
 *
 * `ielts_profiles`: per student in an IELTS centre, the test type (Academic or General
 * Training), the target overall band and per module, and the booked test date.
 *
 * A new empty table; no existing row changes. Safe to run twice; logs a count check.
 */
export class IeltsProfiles1756450000000 implements MigrationInterface {
  name = 'IeltsProfiles1756450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "test_type" character varying(10),
        "target_overall" numeric(2,1),
        "target_bands" jsonb NOT NULL DEFAULT '{}',
        "test_date" date,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ielts_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ielts_profiles_test_type" CHECK ("test_type" IS NULL OR "test_type" IN ('ACADEMIC', 'GENERAL')),
        CONSTRAINT "CHK_ielts_profiles_target" CHECK ("target_overall" IS NULL OR ("target_overall" >= 0 AND "target_overall" <= 9))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ielts_profiles_org_student" ON "ielts_profiles" ("organization_id", "student_id")`);
    for (const [name, definition] of [
      ['FK_ielts_profiles_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['FK_ielts_profiles_student', `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE "ielts_profiles" ADD CONSTRAINT "${name}" ${definition};
          END IF;
        END $$;
      `);
    }
    const [counts] = await queryRunner.query(`SELECT count(*)::int AS profiles FROM ielts_profiles`);
    console.log(`[IeltsProfiles] profiles: ${counts.profiles}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_profiles"`);
  }
}
