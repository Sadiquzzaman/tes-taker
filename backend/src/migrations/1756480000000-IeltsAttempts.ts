import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IELTS assignments, attempts and answers (P10-04, IEL-04–08). Owned by the ielts module.
 *
 * - `ielts_assignments`: a published test opened for a batch (section) between two times;
 *   soft-deleted.
 * - `ielts_attempts`: one per student, assignment and module: the timer (started, deadline),
 *   status, Listening / Reading raw score out of 40 and band; Writing / Speaking criteria come
 *   with P10-05/06.
 * - `ielts_answers`: a student's answer per question (or per Writing task) with its marks.
 *
 * New empty tables; no existing row changes. Safe to run twice; logs a count check.
 */
export class IeltsAttempts1756480000000 implements MigrationInterface {
  name = 'IeltsAttempts1756480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "test_id" uuid NOT NULL,
        "section_id" uuid NOT NULL,
        "opens_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "closes_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        CONSTRAINT "PK_ielts_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ielts_assignments_window" CHECK ("closes_at" > "opens_at")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ielts_assignments_section" ON "ielts_assignments" ("section_id", "opens_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ielts_assignments_test" ON "ielts_assignments" ("test_id")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "test_id" uuid NOT NULL,
        "assignment_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "module" character varying(10) NOT NULL,
        "mode" character varying(10),
        "status" character varying(15) NOT NULL DEFAULT 'IN_PROGRESS',
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deadline" TIMESTAMP WITH TIME ZONE NOT NULL,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "raw_score" smallint,
        "band" numeric(2,1),
        "criteria" jsonb,
        "feedback" text,
        "recording_file_ids" jsonb,
        "marked_by" uuid,
        "marked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_ielts_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ielts_attempts_module" CHECK ("module" IN ('LISTENING', 'READING', 'WRITING', 'SPEAKING')),
        CONSTRAINT "CHK_ielts_attempts_status" CHECK ("status" IN ('IN_PROGRESS', 'SUBMITTED', 'MARKED')),
        CONSTRAINT "CHK_ielts_attempts_mode" CHECK ("mode" IS NULL OR "mode" IN ('LIVE', 'RECORDED')),
        CONSTRAINT "CHK_ielts_attempts_band" CHECK ("band" IS NULL OR ("band" >= 0 AND "band" <= 9)),
        CONSTRAINT "CHK_ielts_attempts_raw" CHECK ("raw_score" IS NULL OR ("raw_score" >= 0 AND "raw_score" <= 40))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ielts_attempts_assignment_student_module" ON "ielts_attempts" ("assignment_id", "student_id", "module")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ielts_attempts_test_student" ON "ielts_attempts" ("test_id", "student_id", "module")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_answers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "attempt_id" uuid NOT NULL,
        "question_id" uuid,
        "part_id" uuid NOT NULL,
        "answer" text,
        "correct" boolean,
        "marks" smallint NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ielts_answers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ielts_answers_question" ON "ielts_answers" ("attempt_id", "question_id") WHERE "question_id" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ielts_answers_part" ON "ielts_answers" ("attempt_id", "part_id") WHERE "question_id" IS NULL`);
    for (const [table, name, definition] of [
      ['ielts_assignments', 'FK_ielts_assignments_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_assignments', 'FK_ielts_assignments_test', `FOREIGN KEY ("test_id") REFERENCES "ielts_tests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_assignments', 'FK_ielts_assignments_section', `FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_attempts', 'FK_ielts_attempts_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_attempts', 'FK_ielts_attempts_test', `FOREIGN KEY ("test_id") REFERENCES "ielts_tests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_attempts', 'FK_ielts_attempts_assignment', `FOREIGN KEY ("assignment_id") REFERENCES "ielts_assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_attempts', 'FK_ielts_attempts_student', `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_answers', 'FK_ielts_answers_attempt', `FOREIGN KEY ("attempt_id") REFERENCES "ielts_attempts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_answers', 'FK_ielts_answers_question', `FOREIGN KEY ("question_id") REFERENCES "ielts_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_answers', 'FK_ielts_answers_part', `FOREIGN KEY ("part_id") REFERENCES "ielts_test_parts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
          END IF;
        END $$;
      `);
    }
    const [counts] = await queryRunner.query(
      `SELECT (SELECT count(*) FROM ielts_assignments)::int AS assignments, (SELECT count(*) FROM ielts_attempts)::int AS attempts, (SELECT count(*) FROM ielts_answers)::int AS answers`,
    );
    console.log(`[IeltsAttempts] assignments: ${counts.assignments}, attempts: ${counts.attempts}, answers: ${counts.answers}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_assignments"`);
  }
}
