import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsModelTestToExams1754300000000 implements MigrationInterface {
  name = 'AddIsModelTestToExams1754300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "exams"
      ADD COLUMN IF NOT EXISTS "is_model_test" boolean NULL
    `);

    // Multi-subject exams (or legacy exam_kind = model) are model tests.
    await queryRunner.query(`
      UPDATE "exams" e
      SET "is_model_test" = CASE
        WHEN e."exam_kind" = 'model' THEN true
        WHEN (
          SELECT COUNT(DISTINCT s."subject_id")
          FROM "exam_question_sections" s
          WHERE s."exam_id" = e."id"
        ) > 1 THEN true
        ELSE false
      END
      WHERE e."is_model_test" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "exams"
      SET "is_model_test" = false
      WHERE "is_model_test" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "exams"
      ALTER COLUMN "is_model_test" SET DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "exams"
      ALTER COLUMN "is_model_test" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "exams"
      DROP COLUMN IF EXISTS "is_model_test"
    `);
  }
}
