import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Org subject catalog: same name may repeat (Physics), unique per org by code (PHY-09 vs PHY-11).
 * Global subjects stay unique by name and remain organization_id NULL.
 */
export class AddOrganizationIdToSubjects1754600000000 implements MigrationInterface {
  name = 'AddOrganizationIdToSubjects1754600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subjects"
      ADD COLUMN IF NOT EXISTS "organization_id" uuid NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subjects_organization_id"
      ON "subjects" ("organization_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "subjects"
          ADD CONSTRAINT "FK_subjects_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_subjects_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_subjects_code"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "UQ_subjects_name"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "UQ_subjects_code"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subjects_global_name"
      ON "subjects" ("name")
      WHERE "organization_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subjects_org_code"
      ON "subjects" ("organization_id", "code")
      WHERE "organization_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_subjects_org_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_subjects_global_name"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "FK_subjects_organization"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subjects_organization_id"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN IF EXISTS "organization_id"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subjects_name" ON "subjects" ("name")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subjects_code" ON "subjects" ("code")
    `);
  }
}
