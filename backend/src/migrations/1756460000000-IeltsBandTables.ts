import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IELTS band tables (P10-02, IEL-04, IEL-05). Owned by the ielts module.
 *
 * `ielts_band_tables`: raw Listening / Reading score (out of 40) → band. Rows without an
 * organisation are the platform defaults (Listening, Academic Reading, General Training
 * Reading), added by the API at boot when missing, as the plans are; a centre that edits a
 * table gets its own copy. One table per organisation (or the platform), module and test type.
 *
 * A new empty table; no existing row changes. Safe to run twice; logs a count check.
 */
export class IeltsBandTables1756460000000 implements MigrationInterface {
  name = 'IeltsBandTables1756460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_band_tables" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid,
        "module" character varying(10) NOT NULL,
        "test_type" character varying(10),
        "rows" jsonb NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ielts_band_tables" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ielts_band_tables_module" CHECK (("module" = 'LISTENING' AND "test_type" IS NULL) OR ("module" = 'READING' AND "test_type" IN ('ACADEMIC', 'GENERAL')))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ielts_band_tables_scope" ON "ielts_band_tables" ((COALESCE("organization_id", '00000000-0000-0000-0000-000000000000'::uuid)), "module", (COALESCE("test_type", '')))`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ielts_band_tables_organization') THEN
          ALTER TABLE "ielts_band_tables" ADD CONSTRAINT "FK_ielts_band_tables_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    const [counts] = await queryRunner.query(
      `SELECT count(*) FILTER (WHERE organization_id IS NULL)::int AS defaults, count(*) FILTER (WHERE organization_id IS NOT NULL)::int AS centres FROM ielts_band_tables`,
    );
    console.log(`[IeltsBandTables] defaults: ${counts.defaults}, centre copies: ${counts.centres}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_band_tables"`);
  }
}
