import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Review and overturn (P8-04, PRO-05). Owned by the exams module.
 *
 * `exam_attempt_reviews`: a teacher's decision on a disqualified or flagged attempt — REINSTATE
 * (a disqualified attempt counts as submitted), RETAKE (the attempt is opened again for the full
 * time; the previous answers and score are kept here in `previous_attempt`) or CONFIRM — with the
 * reason, who and when, and the status and score before. Every decision is kept.
 *
 * A new empty table; no existing row changes. Safe to run twice; logs a count check.
 */
export class ExamAttemptReviews1756420000000 implements MigrationInterface {
  name = 'ExamAttemptReviews1756420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "exam_attempt_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid,
        "exam_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "submission_id" uuid NOT NULL,
        "decision" character varying(10) NOT NULL,
        "reason" character varying(500) NOT NULL,
        "previous_status" character varying(20) NOT NULL,
        "previous_score" numeric(10,2),
        "previous_attempt" jsonb,
        "decided_by" uuid NOT NULL,
        "decided_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_exam_attempt_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_exam_attempt_reviews_decision" CHECK ("decision" IN ('REINSTATE', 'RETAKE', 'CONFIRM'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_exam_attempt_reviews_exam_student" ON "exam_attempt_reviews" ("exam_id", "student_id", "decided_at")`);
    for (const [name, definition] of [
      ['FK_exam_attempt_reviews_exam', `FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['FK_exam_attempt_reviews_student', `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['FK_exam_attempt_reviews_submission', `FOREIGN KEY ("submission_id") REFERENCES "student_exam_submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE "exam_attempt_reviews" ADD CONSTRAINT "${name}" ${definition};
          END IF;
        END $$;
      `);
    }
    const [counts] = await queryRunner.query(`SELECT count(*)::int AS reviews FROM exam_attempt_reviews`);
    console.log(`[ExamAttemptReviews] reviews: ${counts.reviews}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "exam_attempt_reviews"`);
  }
}
