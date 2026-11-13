import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Report cards (P7-04, PRF-09; design §9.8). Owned by the results module.
 *
 * `report_cards`: a student's card for a term (or the whole session when term_id is null) in one
 * section, in Bangla or English, with the teacher's and principal's remarks and the scores frozen
 * when it was made (`scores_snapshot`). Making it again after a change adds a new version; earlier
 * versions are kept. A removed term leaves its cards (term_id becomes null; the snapshot keeps the
 * term's name). `share_*` holds the guardian link (P7-04 part 2): only a hash of the token.
 *
 * A new empty table; no existing row changes. Safe to run twice; logs a count check.
 */
export class ReportCards1756380000000 implements MigrationInterface {
  name = 'ReportCards1756380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_cards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "term_id" uuid,
        "section_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "version" smallint NOT NULL DEFAULT 1,
        "locale" character varying(5) NOT NULL,
        "teacher_remark" character varying(500),
        "principal_remark" character varying(500),
        "scores_snapshot" jsonb NOT NULL,
        "generated_by" uuid,
        "generated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "share_token_hash" character varying(128),
        "share_expires_at" TIMESTAMP WITH TIME ZONE,
        "shared_at" TIMESTAMP WITH TIME ZONE,
        "shared_by" uuid,
        CONSTRAINT "PK_report_cards" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_report_cards_locale" CHECK ("locale" IN ('bn', 'en'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_report_cards_version" ON "report_cards" ("student_id", "section_id", (COALESCE("term_id", '00000000-0000-0000-0000-000000000000'::uuid)), "version")`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_report_cards_section" ON "report_cards" ("organization_id", "section_id", "term_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_report_cards_share_token" ON "report_cards" ("share_token_hash") WHERE "share_token_hash" IS NOT NULL`);
    await this.addConstraint(queryRunner, 'report_cards', 'FK_report_cards_org',
      `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'report_cards', 'FK_report_cards_session',
      `FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'report_cards', 'FK_report_cards_term',
      `FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'report_cards', 'FK_report_cards_section',
      `FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'report_cards', 'FK_report_cards_student',
      `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`SELECT count(*)::int AS cards FROM report_cards`);
    console.log(`[ReportCards] cards: ${counts.cards}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_cards"`);
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
