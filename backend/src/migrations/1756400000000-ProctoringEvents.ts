import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Proctoring events as rows (P8-02, PRO-07; design §6.2). Owned by the exams module.
 *
 * `proctoring_events`: every flag a student's browser raises during an exam (sent live, or with
 * the final submit), and what the server notices itself (monitoring lost and back), with the
 * check it belongs to. A flag sent both live and at submit is stored once (its client id).
 * Until now flags lived only in the submission's JSON column, which stays as it is.
 *
 * A new empty table; no existing row changes. Safe to run twice; logs a count check.
 */
export class ProctoringEvents1756400000000 implements MigrationInterface {
  name = 'ProctoringEvents1756400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "proctoring_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid,
        "exam_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "client_id" character varying(64),
        "type" character varying(40) NOT NULL,
        "check_key" character varying(60),
        "message" character varying(300),
        "points" smallint NOT NULL DEFAULT 0,
        "source" character varying(10) NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_proctoring_events" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_proctoring_events_source" CHECK ("source" IN ('LIVE', 'SUBMIT', 'SERVER'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_proctoring_events_exam_student" ON "proctoring_events" ("exam_id", "student_id", "occurred_at")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_proctoring_events_client" ON "proctoring_events" ("exam_id", "student_id", "client_id") WHERE "client_id" IS NOT NULL`,
    );
    await this.addConstraint(queryRunner, 'FK_proctoring_events_exam', `FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'FK_proctoring_events_student', `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`SELECT count(*)::int AS events FROM proctoring_events`);
    console.log(`[ProctoringEvents] events: ${counts.events}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "proctoring_events"`);
  }

  private async addConstraint(queryRunner: QueryRunner, name: string, definition: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "proctoring_events" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$;
    `);
  }
}
