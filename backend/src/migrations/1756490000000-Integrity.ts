import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plagiarism checks (P10-09, PLG-01–03). Owned by the integrity module; the thresholds are an
 * org_settings column (owned by organizations).
 *
 * - `similarity_checks`: one run over a scope (a homework, or an IELTS opening's Writing).
 * - `similarity_matches`: a pair of submissions with their similarity, the matching passages and
 *   the teacher's review (OK or COPIED, with a note).
 * - `org_settings.plagiarism_thresholds`: {high, medium, min_words}; null = the defaults (40, 20, 50).
 *
 * New empty tables and a nullable column; no existing row changes. Safe to run twice; logs a count check.
 */
export class Integrity1756490000000 implements MigrationInterface {
  name = 'Integrity1756490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_settings" ADD COLUMN IF NOT EXISTS "plagiarism_thresholds" jsonb`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "similarity_checks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "scope_type" character varying(20) NOT NULL,
        "scope_id" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'DONE',
        "submissions" integer NOT NULL DEFAULT 0,
        "ran_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ran_by" uuid,
        CONSTRAINT "PK_similarity_checks" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_similarity_checks_scope" CHECK ("scope_type" IN ('HOMEWORK', 'IELTS_WRITING')),
        CONSTRAINT "CHK_similarity_checks_status" CHECK ("status" IN ('DONE'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_similarity_checks_scope" ON "similarity_checks" ("organization_id", "scope_type", "scope_id", "ran_at")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "similarity_matches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "check_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "submission_a" uuid NOT NULL,
        "submission_b" uuid NOT NULL,
        "student_a" uuid NOT NULL,
        "student_b" uuid NOT NULL,
        "score" numeric(5,2) NOT NULL,
        "spans" jsonb NOT NULL,
        "review_decision" character varying(10),
        "review_note" text,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_similarity_matches" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_similarity_matches_decision" CHECK ("review_decision" IS NULL OR "review_decision" IN ('OK', 'COPIED'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_similarity_matches_check" ON "similarity_matches" ("check_id", "score")`);
    for (const [table, name, definition] of [
      ['similarity_checks', 'FK_similarity_checks_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['similarity_matches', 'FK_similarity_matches_check', `FOREIGN KEY ("check_id") REFERENCES "similarity_checks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
          END IF;
        END $$;
      `);
    }
    const [counts] = await queryRunner.query(`SELECT (SELECT count(*) FROM similarity_checks)::int AS checks, (SELECT count(*) FROM similarity_matches)::int AS matches`);
    console.log(`[Integrity] checks: ${counts.checks}, matches: ${counts.matches}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "similarity_matches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "similarity_checks"`);
    await queryRunner.query(`ALTER TABLE "org_settings" DROP COLUMN IF EXISTS "plagiarism_thresholds"`);
  }
}
