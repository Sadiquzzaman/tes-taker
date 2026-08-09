import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Production-safe: add exam_questions.subject_id for DBs that already have question rows.
 *
 * Order matters:
 *  1) Add column as NULLABLE
 *  2) Backfill every existing row from the current schema
 *  3) SET NOT NULL only when zero nulls remain
 *  4) Add FK + index after data is valid
 */
export class AddSubjectIdToExamQuestions1754200000000 implements MigrationInterface {
  name = 'AddSubjectIdToExamQuestions1754200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add as nullable — never NOT NULL on a table that may already have rows
    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ADD COLUMN IF NOT EXISTS "subject_id" uuid NULL
    `);

    // Re-runs after a failed SET NOT NULL: ensure we can still backfill nulls
    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ALTER COLUMN "subject_id" DROP NOT NULL
    `);

    // 2a) Wizard / sectioned exams: inherit from the question's section
    await queryRunner.query(`
      UPDATE "exam_questions" AS q
      SET "subject_id" = s."subject_id"
      FROM "exam_question_sections" AS s
      WHERE q."section_id" = s."id"
        AND q."subject_id" IS NULL
        AND s."subject_id" IS NOT NULL
    `);

    // 2b) Hybrid / single-subject exams: exam_questions -> exams.primary_subject_id
    await queryRunner.query(`
      UPDATE "exam_questions" AS q
      SET "subject_id" = e."primary_subject_id"
      FROM "exams" AS e
      WHERE q."exam_id" = e."id"
        AND q."subject_id" IS NULL
        AND e."primary_subject_id" IS NOT NULL
    `);

    // 2c) Same exam, any section (covers questions with null section_id on multi-subject exams)
    await queryRunner.query(`
      UPDATE "exam_questions" AS q
      SET "subject_id" = src."subject_id"
      FROM (
        SELECT DISTINCT ON (s."exam_id")
          s."exam_id",
          s."subject_id"
        FROM "exam_question_sections" AS s
        WHERE s."subject_id" IS NOT NULL
        ORDER BY s."exam_id", s."sort_order" ASC, s."created_at" ASC
      ) AS src
      WHERE q."exam_id" = src."exam_id"
        AND q."subject_id" IS NULL
    `);

    // 2d) Sibling questions on the same exam that already have a subject
    await queryRunner.query(`
      UPDATE "exam_questions" AS q
      SET "subject_id" = src."subject_id"
      FROM (
        SELECT DISTINCT ON (q2."exam_id")
          q2."exam_id",
          q2."subject_id"
        FROM "exam_questions" AS q2
        WHERE q2."subject_id" IS NOT NULL
        ORDER BY q2."exam_id", q2."sort_order" ASC, q2."created_at" ASC
      ) AS src
      WHERE q."exam_id" = src."exam_id"
        AND q."subject_id" IS NULL
    `);

    // 2e) Legacy rows: match exams.subject text to subjects.name / subjects.code
    await queryRunner.query(`
      UPDATE "exam_questions" AS q
      SET "subject_id" = sub."id"
      FROM "exams" AS e
      INNER JOIN "subjects" AS sub
        ON (
          lower(trim(sub."name")) = lower(trim(e."subject"))
          OR (
            sub."code" IS NOT NULL
            AND trim(sub."code") <> ''
            AND lower(trim(sub."code")) = lower(trim(e."subject"))
          )
        )
      WHERE q."exam_id" = e."id"
        AND q."subject_id" IS NULL
        AND e."subject" IS NOT NULL
        AND trim(e."subject") <> ''
    `);

    // 3) Refuse NOT NULL until every row is populated (robust across driver result shapes)
    const unresolvedRows = await queryRunner.query(`
      SELECT q."id"
      FROM "exam_questions" AS q
      WHERE q."subject_id" IS NULL
      LIMIT 20
    `);
    const unresolvedSample = Array.isArray(unresolvedRows) ? unresolvedRows : [];
    if (unresolvedSample.length > 0) {
      const countResult = await queryRunner.query(`
        SELECT COUNT(*)::text AS "cnt"
        FROM "exam_questions"
        WHERE "subject_id" IS NULL
      `);
      const unresolvedCount = Number(
        countResult?.[0]?.cnt ?? countResult?.[0]?.count ?? countResult?.[0]?.['COUNT'] ?? unresolvedSample.length,
      );
      const sampleIds = unresolvedSample
        .map((row: { id?: string }) => row?.id)
        .filter(Boolean)
        .join(', ');
      throw new Error(
        `Cannot set exam_questions.subject_id NOT NULL: ${unresolvedCount} question(s) still have NULL subject_id ` +
          `after backfill from section, exam.primary_subject_id, exam sections, sibling questions, and exams.subject. ` +
          `Sample id(s): ${sampleIds || '(unknown)'}`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ALTER COLUMN "subject_id" SET NOT NULL
    `);

    // 4) Constraints / indexes only after data is valid
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
