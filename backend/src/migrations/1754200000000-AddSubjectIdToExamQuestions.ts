import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubjectIdToExamQuestions1754200000000 implements MigrationInterface {
  name = 'AddSubjectIdToExamQuestions1754200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ADD COLUMN IF NOT EXISTS "subject_id" uuid NULL
    `);

    await queryRunner.query(`
      UPDATE "exam_questions" q
      SET "subject_id" = s."subject_id"
      FROM "exam_question_sections" s
      WHERE q."section_id" = s."id"
        AND q."subject_id" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "exam_questions" q
      SET "subject_id" = e."primary_subject_id"
      FROM "exams" e
      WHERE q."exam_id" = e."id"
        AND q."subject_id" IS NULL
        AND e."primary_subject_id" IS NOT NULL
    `);

    await queryRunner.query(`
      DELETE FROM "exam_questions"
      WHERE "subject_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ALTER COLUMN "subject_id" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_exam_questions_subject_id'
        ) THEN
          ALTER TABLE "exam_questions"
          ADD CONSTRAINT "FK_exam_questions_subject_id"
          FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
          ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_exam_questions_subject_id"
      ON "exam_questions" ("subject_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_exam_questions_subject_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      DROP CONSTRAINT IF EXISTS "FK_exam_questions_subject_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      DROP COLUMN IF EXISTS "subject_id"
    `);
  }
}
