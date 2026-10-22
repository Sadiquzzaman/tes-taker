import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stores each attempt's deadline at start (design §6.2). Existing rows stay NULL:
 * the app computes their deadline from started_at and the exam, as before.
 */
export class AddEffectiveDeadlineToSubmissions1754900000000 implements MigrationInterface {
  name = 'AddEffectiveDeadlineToSubmissions1754900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_exam_submissions"
      ADD COLUMN IF NOT EXISTS "effective_deadline" timestamptz NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_student_exam_submissions_status_deadline"
      ON "student_exam_submissions" ("status", "effective_deadline")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_student_exam_submissions_status_deadline"
    `);
    await queryRunner.query(`
      ALTER TABLE "student_exam_submissions"
      DROP COLUMN IF EXISTS "effective_deadline"
    `);
  }
}
