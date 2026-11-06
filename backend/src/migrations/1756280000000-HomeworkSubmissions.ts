import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Handing homework in (P5-02, HW-03; design §9.5).
 *
 * Adds to `org_settings` (owned by organizations, rules in homework) the homework settings of the
 * spec's Epic 2 table, with their defaults: late work accepted (true), late penalty (NONE, 0 %),
 * resubmissions (1) and files per hand-in (5).
 * Creates, owned by homework:
 * - `homework_submissions`: each hand-in of a homework by a student, versioned (unique per homework,
 *   student and version), with the typed answer, when, late and by how much, and its status
 *   (SUBMITTED, RETURNED, SCORED).
 * - `submission_files`: a hand-in's files in page order.
 *
 * New columns with defaults and new empty tables; no existing value changes. Safe to run twice;
 * logs a count check.
 */
export class HomeworkSubmissions1756280000000 implements MigrationInterface {
  name = 'HomeworkSubmissions1756280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "org_settings"
        ADD COLUMN IF NOT EXISTS "homework_late_allowed" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "homework_late_penalty_type" character varying(10) NOT NULL DEFAULT 'NONE',
        ADD COLUMN IF NOT EXISTS "homework_late_penalty_percent" smallint NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "homework_resubmissions" smallint NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "homework_max_files" smallint NOT NULL DEFAULT 5
    `);
    await this.addConstraint(queryRunner, 'org_settings', 'CHK_org_settings_homework_resubmissions', `CHECK ("homework_resubmissions" BETWEEN 0 AND 3)`);
    await this.addConstraint(queryRunner, 'org_settings', 'CHK_org_settings_homework_max_files', `CHECK ("homework_max_files" BETWEEN 1 AND 10)`);
    await this.addConstraint(
      queryRunner,
      'org_settings',
      'CHK_org_settings_homework_late_penalty',
      `CHECK ("homework_late_penalty_type" IN ('NONE', 'PER_DAY', 'FIXED') AND "homework_late_penalty_percent" BETWEEN 0 AND 100)`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."submission_status" AS ENUM('SUBMITTED', 'RETURNED', 'SCORED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homework_submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "homework_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "version" smallint NOT NULL DEFAULT 1,
        "text_answer" text,
        "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "is_late" boolean NOT NULL DEFAULT false,
        "late_minutes" integer,
        "status" "public"."submission_status" NOT NULL DEFAULT 'SUBMITTED',
        CONSTRAINT "PK_homework_submissions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_homework_submissions_version" ON "homework_submissions" ("homework_id", "student_id", "version")`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_homework_submissions_org" ON "homework_submissions" ("organization_id", "homework_id")`);
    await this.addConstraint(queryRunner, 'homework_submissions', 'FK_homework_submissions_homework',
      `FOREIGN KEY ("homework_id") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'homework_submissions', 'FK_homework_submissions_student',
      `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "submission_files" (
        "submission_id" uuid NOT NULL,
        "file_id" uuid NOT NULL,
        "page_order" smallint NOT NULL DEFAULT 0,
        CONSTRAINT "PK_submission_files" PRIMARY KEY ("submission_id", "file_id")
      )
    `);
    await this.addConstraint(queryRunner, 'submission_files', 'FK_submission_files_submission',
      `FOREIGN KEY ("submission_id") REFERENCES "homework_submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'submission_files', 'FK_submission_files_file',
      `FOREIGN KEY ("file_id") REFERENCES "file_objects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM org_settings) AS settings,
        (SELECT count(*)::int FROM homework_submissions) AS submissions,
        (SELECT count(*)::int FROM submission_files) AS files
    `);
    console.log(`[HomeworkSubmissions] org_settings rows: ${counts.settings}, submissions: ${counts.submissions}, files: ${counts.files}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "submission_files"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "homework_submissions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."submission_status"`);
    for (const name of ['CHK_org_settings_homework_late_penalty', 'CHK_org_settings_homework_max_files', 'CHK_org_settings_homework_resubmissions']) {
      await queryRunner.query(`ALTER TABLE "org_settings" DROP CONSTRAINT IF EXISTS "${name}"`);
    }
    await queryRunner.query(`
      ALTER TABLE "org_settings"
        DROP COLUMN IF EXISTS "homework_max_files",
        DROP COLUMN IF EXISTS "homework_resubmissions",
        DROP COLUMN IF EXISTS "homework_late_penalty_percent",
        DROP COLUMN IF EXISTS "homework_late_penalty_type",
        DROP COLUMN IF EXISTS "homework_late_allowed"
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
