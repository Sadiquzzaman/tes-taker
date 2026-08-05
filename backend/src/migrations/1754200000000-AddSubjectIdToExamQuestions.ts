import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubjectIdToExamQuestions1754200000000 implements MigrationInterface {
  name = 'AddSubjectIdToExamQuestions1754200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ADD COLUMN IF NOT EXISTS "subject_id" uuid NULL
    `);

    // 1) Wizard exams: question inherits subject from its section (exam subject bucket)
    await queryRunner.query(`
      UPDATE "exam_questions" q
      SET "subject_id" = s."subject_id"
      FROM "exam_question_sections" s
      WHERE q."section_id" = s."id"
        AND q."subject_id" IS NULL
    `);

    // 2) Single-subject / hybrid exams: use exam.primary_subject_id
    await queryRunner.query(`
      UPDATE "exam_questions" q
      SET "subject_id" = e."primary_subject_id"
      FROM "exams" e
      WHERE q."exam_id" = e."id"
        AND q."subject_id" IS NULL
        AND e."primary_subject_id" IS NOT NULL
    `);

    // 3) Legacy rows: match exams.subject text label to subjects.name / subjects.code
    await queryRunner.query(`
      UPDATE "exam_questions" q
      SET "subject_id" = sub."id"
      FROM "exams" e
      INNER JOIN "subjects" sub
        ON (
          lower(trim(sub."name")) = lower(trim(e."subject"))
          OR lower(trim(COALESCE(sub."code", ''))) = lower(trim(e."subject"))
        )
      WHERE q."exam_id" = e."id"
        AND q."subject_id" IS NULL
        AND e."subject" IS NOT NULL
        AND trim(e."subject") <> ''
    `);

    const unresolved = await queryRunner.query(`
      SELECT COUNT(*)::int AS count
      FROM "exam_questions"
      WHERE "subject_id" IS NULL
    `);
    const unresolvedCount = Number(unresolved?.[0]?.count ?? 0);
    if (unresolvedCount > 0) {
      throw new Error(
        `Cannot set exam_questions.subject_id NOT NULL: ${unresolvedCount} question(s) have no resolvable subject. ` +
          `Backfill failed for rows missing section.subject_id, exam.primary_subject_id, and a matching subjects.name/code for exams.subject.`,
      );
    }

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
