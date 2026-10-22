import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Org subjects: unique by (organization, name, code), not code alone.
 * Physics/PHY-901 twice is rejected; Physics/PHY-902 is allowed.
 */
export class UniqueOrgSubjectNameCode1754700000000 implements MigrationInterface {
  name = 'UniqueOrgSubjectNameCode1754700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_subjects_org_code"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subjects_org_name_code"
      ON "subjects" ("organization_id", LOWER("name"), LOWER("code"))
      WHERE "organization_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_subjects_org_name_code"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subjects_org_code"
      ON "subjects" ("organization_id", "code")
      WHERE "organization_id" IS NOT NULL
    `);
  }
}
