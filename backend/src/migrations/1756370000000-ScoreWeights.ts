import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Score weights and performance settings (P7-02, PRF-01, PRF-07, PRF-10; design §9.8).
 *
 * - `score_weights` (results module): how much exams, homework, attendance and behaviour count in
 *   a class's score for a session, in whole percent adding up to 100. A class without a row uses
 *   the spec's default, 50/20/20/10.
 * - `org_settings` (organizations module) gains the at-risk thresholds of the class dashboard
 *   (score below 40%, attendance below 75%, 3 or more missing homework) and `show_rank`: whether
 *   students see their merit position (off by default).
 *
 * A new empty table and new columns with defaults; no existing row changes meaning. Safe to run
 * twice; logs a count check.
 */
export class ScoreWeights1756370000000 implements MigrationInterface {
  name = 'ScoreWeights1756370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "score_weights" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "class_id" uuid NOT NULL,
        "exams_pct" smallint NOT NULL,
        "homework_pct" smallint NOT NULL,
        "attendance_pct" smallint NOT NULL,
        "behaviour_pct" smallint NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by" uuid,
        "updated_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_score_weights" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_score_weights_range" CHECK ("exams_pct" BETWEEN 0 AND 100 AND "homework_pct" BETWEEN 0 AND 100 AND "attendance_pct" BETWEEN 0 AND 100 AND "behaviour_pct" BETWEEN 0 AND 100),
        CONSTRAINT "CHK_score_weights_sum" CHECK ("exams_pct" + "homework_pct" + "attendance_pct" + "behaviour_pct" = 100)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_score_weights_class" ON "score_weights" ("session_id", "class_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_score_weights_org" ON "score_weights" ("organization_id")`);
    await this.addConstraint(queryRunner, 'score_weights', 'FK_score_weights_org',
      `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'score_weights', 'FK_score_weights_session',
      `FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'score_weights', 'FK_score_weights_class',
      `FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      ALTER TABLE "org_settings"
        ADD COLUMN IF NOT EXISTS "at_risk_score_pct" smallint NOT NULL DEFAULT 40,
        ADD COLUMN IF NOT EXISTS "at_risk_attendance_pct" smallint NOT NULL DEFAULT 75,
        ADD COLUMN IF NOT EXISTS "at_risk_missing_homework" smallint NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS "show_rank" boolean NOT NULL DEFAULT false
    `);
    await this.addConstraint(queryRunner, 'org_settings', 'CHK_org_settings_at_risk',
      `CHECK ("at_risk_score_pct" BETWEEN 0 AND 100 AND "at_risk_attendance_pct" BETWEEN 0 AND 100 AND "at_risk_missing_homework" BETWEEN 1 AND 50)`);

    const [counts] = await queryRunner.query(`
      SELECT (SELECT count(*)::int FROM score_weights) AS weights, (SELECT count(*)::int FROM org_settings WHERE show_rank) AS showing_rank
    `);
    console.log(`[ScoreWeights] weights: ${counts.weights}, showing rank: ${counts.showing_rank}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_settings" DROP CONSTRAINT IF EXISTS "CHK_org_settings_at_risk"`);
    await queryRunner.query(`
      ALTER TABLE "org_settings"
        DROP COLUMN IF EXISTS "show_rank",
        DROP COLUMN IF EXISTS "at_risk_missing_homework",
        DROP COLUMN IF EXISTS "at_risk_attendance_pct",
        DROP COLUMN IF EXISTS "at_risk_score_pct"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "score_weights"`);
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
