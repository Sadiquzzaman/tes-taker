import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExamCategoryAndIeltsModules1754400000000 implements MigrationInterface {
  name = 'AddExamCategoryAndIeltsModules1754400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "exams"
      ADD COLUMN IF NOT EXISTS "exam_category" varchar(30) NULL
    `);

    await queryRunner.query(`
      UPDATE "exams"
      SET "exam_category" = 'academic'
      WHERE "exam_category" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "exams"
      ALTER COLUMN "exam_category" SET DEFAULT 'academic'
    `);

    await queryRunner.query(`
      ALTER TABLE "exams"
      ALTER COLUMN "exam_category" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_exams_exam_category"
      ON "exams" ("exam_category")
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_question_sections"
      ADD COLUMN IF NOT EXISTS "module_key" varchar(60) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_question_sections"
      ALTER COLUMN "subject_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ADD COLUMN IF NOT EXISTS "module_key" varchar(60) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ADD COLUMN IF NOT EXISTS "audio_url" varchar(2048) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ADD COLUMN IF NOT EXISTS "time_limit_seconds" int NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ADD COLUMN IF NOT EXISTS "media_meta_json" jsonb NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ALTER COLUMN "subject_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "student_exam_answers"
      ADD COLUMN IF NOT EXISTS "media_url" varchar(2048) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_exam_answers"
      DROP COLUMN IF EXISTS "media_url"
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      DROP COLUMN IF EXISTS "media_meta_json"
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      DROP COLUMN IF EXISTS "time_limit_seconds"
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      DROP COLUMN IF EXISTS "audio_url"
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      DROP COLUMN IF EXISTS "module_key"
    `);

    // Restore NOT NULL only for rows that still have a subject
    await queryRunner.query(`
      UPDATE "exam_questions"
      SET "subject_id" = (
        SELECT e."primary_subject_id" FROM "exams" e WHERE e."id" = "exam_questions"."exam_id"
      )
      WHERE "subject_id" IS NULL
        AND EXISTS (
          SELECT 1 FROM "exams" e
          WHERE e."id" = "exam_questions"."exam_id" AND e."primary_subject_id" IS NOT NULL
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_question_sections"
      DROP COLUMN IF EXISTS "module_key"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_exams_exam_category"
    `);

    await queryRunner.query(`
      ALTER TABLE "exams"
      DROP COLUMN IF EXISTS "exam_category"
    `);
  }
}
