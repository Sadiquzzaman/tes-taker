import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Class behaviour (P7-01, PRF-04; design §9.8). Owned by the results module.
 *
 * - `behaviour_criteria`: what each organisation rates (e.g. participation, discipline,
 *   attentiveness), in English and Bangla, in order; a criterion is retired (is_active false,
 *   retired_at) rather than deleted, so its ratings keep their meaning.
 * - `behaviour_ratings`: a 1–5 rating of a student on a criterion in a subject class on a date,
 *   with an optional remark. One per subject class, student, criterion and date (rating again the
 *   same day replaces it); the term average is what counts.
 *
 * New empty tables only; no existing row changes. Safe to run twice; logs a count check.
 */
export class BehaviourRatings1756360000000 implements MigrationInterface {
  name = 'BehaviourRatings1756360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "behaviour_criteria" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "name_en" character varying(80) NOT NULL,
        "name_bn" character varying(80) NOT NULL,
        "sort_order" smallint NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "retired_at" TIMESTAMP WITH TIME ZONE,
        "retired_by" uuid,
        CONSTRAINT "PK_behaviour_criteria" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_behaviour_criteria_org" ON "behaviour_criteria" ("organization_id", "is_active")`);
    await this.addConstraint(queryRunner, 'behaviour_criteria', 'FK_behaviour_criteria_org',
      `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "behaviour_ratings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "offering_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "criterion_id" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "remark" character varying(300),
        "rated_on" date NOT NULL,
        "rated_by" uuid,
        "rated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_behaviour_ratings" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_behaviour_ratings_rating" CHECK ("rating" BETWEEN 1 AND 5)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_behaviour_ratings_day" ON "behaviour_ratings" ("offering_id", "student_id", "criterion_id", "rated_on")`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_behaviour_ratings_org_student" ON "behaviour_ratings" ("organization_id", "student_id", "rated_on")`);
    await this.addConstraint(queryRunner, 'behaviour_ratings', 'FK_behaviour_ratings_offering',
      `FOREIGN KEY ("offering_id") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'behaviour_ratings', 'FK_behaviour_ratings_student',
      `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'behaviour_ratings', 'FK_behaviour_ratings_criterion',
      `FOREIGN KEY ("criterion_id") REFERENCES "behaviour_criteria"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT (SELECT count(*)::int FROM behaviour_criteria) AS criteria, (SELECT count(*)::int FROM behaviour_ratings) AS ratings
    `);
    console.log(`[BehaviourRatings] criteria: ${counts.criteria}, ratings: ${counts.ratings}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "behaviour_ratings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "behaviour_criteria"`);
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
