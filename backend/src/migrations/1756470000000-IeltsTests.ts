import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IELTS tests (P10-02, IEL-03). Owned by the ielts module.
 *
 * - `ielts_tests`: a mock (the real template) or a practice set, with its modules, the time per
 *   module and its status; soft-deleted. `source_exam_id` / `needs_review` are for tests copied
 *   from the academic builder (P10-08).
 * - `ielts_test_parts`: Listening parts 1–4 (one recording each), Reading passages 1–3, Writing
 *   tasks 1–2, Speaking parts 1–3.
 * - `ielts_question_groups`: the unit of the real paper (one instruction, a word limit, a shared
 *   list or a picture); soft-deleted.
 * - `ielts_questions`: one or more accepted answers or the right keys; soft-deleted. Numbers 1–40
 *   are worked out from the order.
 *
 * New empty tables; no existing row changes. Safe to run twice; logs a count check.
 */
export class IeltsTests1756470000000 implements MigrationInterface {
  name = 'IeltsTests1756470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_tests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "test_type" character varying(10) NOT NULL,
        "purpose" character varying(10) NOT NULL,
        "modules" jsonb NOT NULL,
        "durations" jsonb NOT NULL,
        "status" character varying(10) NOT NULL DEFAULT 'DRAFT',
        "source_exam_id" uuid,
        "needs_review" boolean NOT NULL DEFAULT false,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        CONSTRAINT "PK_ielts_tests" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ielts_tests_test_type" CHECK ("test_type" IN ('ACADEMIC', 'GENERAL')),
        CONSTRAINT "CHK_ielts_tests_purpose" CHECK ("purpose" IN ('MOCK', 'PRACTICE')),
        CONSTRAINT "CHK_ielts_tests_status" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ielts_tests_organization" ON "ielts_tests" ("organization_id", "status")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_test_parts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "test_id" uuid NOT NULL,
        "module" character varying(10) NOT NULL,
        "part_no" smallint NOT NULL,
        "title" character varying(200),
        "content" text,
        "audio_file_id" uuid,
        "image_file_id" uuid,
        CONSTRAINT "PK_ielts_test_parts" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ielts_test_parts_part_no" CHECK (
          ("module" = 'LISTENING' AND "part_no" BETWEEN 1 AND 4) OR ("module" = 'READING' AND "part_no" BETWEEN 1 AND 3)
          OR ("module" = 'WRITING' AND "part_no" BETWEEN 1 AND 2) OR ("module" = 'SPEAKING' AND "part_no" BETWEEN 1 AND 3)
        )
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ielts_test_parts_test_part" ON "ielts_test_parts" ("test_id", "module", "part_no")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_question_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "part_id" uuid NOT NULL,
        "type" character varying(30) NOT NULL,
        "instruction" text NOT NULL,
        "word_limit" smallint,
        "shared" jsonb,
        "image_file_id" uuid,
        "sort_order" smallint NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        CONSTRAINT "PK_ielts_question_groups" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ielts_question_groups_word_limit" CHECK ("word_limit" IS NULL OR "word_limit" BETWEEN 1 AND 5)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ielts_question_groups_part" ON "ielts_question_groups" ("part_id", "sort_order")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_questions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "group_id" uuid NOT NULL,
        "sort_order" smallint NOT NULL,
        "prompt" text,
        "options" jsonb,
        "answer" jsonb NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_ielts_questions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ielts_questions_group" ON "ielts_questions" ("group_id", "sort_order")`);
    for (const [table, name, definition] of [
      ['ielts_tests', 'FK_ielts_tests_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_tests', 'FK_ielts_tests_source_exam', `FOREIGN KEY ("source_exam_id") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`],
      ['ielts_tests', 'FK_ielts_tests_created_by', `FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`],
      ['ielts_test_parts', 'FK_ielts_test_parts_test', `FOREIGN KEY ("test_id") REFERENCES "ielts_tests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_test_parts', 'FK_ielts_test_parts_audio', `FOREIGN KEY ("audio_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`],
      ['ielts_test_parts', 'FK_ielts_test_parts_image', `FOREIGN KEY ("image_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`],
      ['ielts_question_groups', 'FK_ielts_question_groups_part', `FOREIGN KEY ("part_id") REFERENCES "ielts_test_parts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['ielts_question_groups', 'FK_ielts_question_groups_image', `FOREIGN KEY ("image_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`],
      ['ielts_questions', 'FK_ielts_questions_group', `FOREIGN KEY ("group_id") REFERENCES "ielts_question_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
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
      `SELECT (SELECT count(*) FROM ielts_tests)::int AS tests, (SELECT count(*) FROM ielts_test_parts)::int AS parts,
              (SELECT count(*) FROM ielts_question_groups)::int AS groups, (SELECT count(*) FROM ielts_questions)::int AS questions`,
    );
    console.log(`[IeltsTests] tests: ${counts.tests}, parts: ${counts.parts}, groups: ${counts.groups}, questions: ${counts.questions}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_question_groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_test_parts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_tests"`);
  }
}
