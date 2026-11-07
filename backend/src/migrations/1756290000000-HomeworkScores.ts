import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reviewing and scoring homework (P5-03, HW-04, HW-05, HW-06; design §9.5).
 *
 * Adds `homework.scores_published_at` (students see scores from then on). Creates, owned by
 * homework, `homework_scores`: one per homework and student, with the raw score, the late penalty
 * taken off, the final score, feedback, optional 1–5 ratings, "never handed in", and who scored it
 * and when.
 *
 * A nullable column and a new empty table; no existing row changes. Safe to run twice; logs a
 * count check.
 */
export class HomeworkScores1756290000000 implements MigrationInterface {
  name = 'HomeworkScores1756290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "scores_published_at" TIMESTAMP WITH TIME ZONE`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homework_scores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "homework_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "submission_id" uuid,
        "raw_score" numeric(6,2),
        "penalty" numeric(6,2) NOT NULL DEFAULT 0,
        "final_score" numeric(6,2),
        "feedback" text,
        "ratings" jsonb,
        "is_missing" boolean NOT NULL DEFAULT false,
        "scored_by" uuid,
        "scored_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_homework_scores" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_homework_scores_student" ON "homework_scores" ("homework_id", "student_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_homework_scores_org" ON "homework_scores" ("organization_id", "homework_id")`);
    await this.addConstraint(queryRunner, 'homework_scores', 'FK_homework_scores_homework',
      `FOREIGN KEY ("homework_id") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'homework_scores', 'FK_homework_scores_student',
      `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'homework_scores', 'FK_homework_scores_submission',
      `FOREIGN KEY ("submission_id") REFERENCES "homework_submissions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT (SELECT count(*)::int FROM homework) AS homework, (SELECT count(*)::int FROM homework_scores) AS scores
    `);
    console.log(`[HomeworkScores] homework: ${counts.homework}, scores: ${counts.scores}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "homework_scores"`);
    await queryRunner.query(`ALTER TABLE "homework" DROP COLUMN IF EXISTS "scores_published_at"`);
  }

  private async addConstraint(queryRunner: QueryRunner, table: string, name: string, definition: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$;
    `);
  }
}
