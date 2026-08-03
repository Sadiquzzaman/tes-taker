import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProctoringEventsToSubmissions1754100000000 implements MigrationInterface {
  name = 'AddProctoringEventsToSubmissions1754100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_exam_submissions"
      ADD COLUMN IF NOT EXISTS "proctoring_events_json" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "student_exam_submissions"
      ADD COLUMN IF NOT EXISTS "disqualification_reason" varchar(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_exam_submissions"
      DROP COLUMN IF EXISTS "disqualification_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "student_exam_submissions"
      DROP COLUMN IF EXISTS "proctoring_events_json"
    `);
  }
}
