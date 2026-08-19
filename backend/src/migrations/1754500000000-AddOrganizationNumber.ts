import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds unique public organization_number starting at 100001.
 * Backfills existing organizations ordered by created_at.
 */
export class AddOrganizationNumber1754500000000 implements MigrationInterface {
  name = 'AddOrganizationNumber1754500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "organization_number" BIGINT NULL
    `);

    await queryRunner.query(`
      WITH numbered AS (
        SELECT
          "id",
          (100000 + ROW_NUMBER() OVER (ORDER BY "created_at" ASC NULLS LAST, "id" ASC))::bigint AS num
        FROM "organizations"
        WHERE "organization_number" IS NULL
      )
      UPDATE "organizations" AS org
      SET "organization_number" = numbered.num
      FROM numbered
      WHERE org."id" = numbered."id"
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations"
      ALTER COLUMN "organization_number" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "organizations"
          ADD CONSTRAINT "UQ_organizations_organization_number" UNIQUE ("organization_number");
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_organizations_organization_number"
      ON "organizations" ("organization_number")
    `);

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS "organizations_organization_number_seq"
    `);

    await queryRunner.query(`
      SELECT setval(
        'organizations_organization_number_seq',
        COALESCE((SELECT MAX("organization_number") FROM "organizations"), 100000)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations"
      ALTER COLUMN "organization_number"
      SET DEFAULT nextval('organizations_organization_number_seq')
    `);

    await queryRunner.query(`
      ALTER SEQUENCE "organizations_organization_number_seq"
      OWNED BY "organizations"."organization_number"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ALTER COLUMN "organization_number" DROP DEFAULT
    `);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "organizations_organization_number_seq"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_organization_number"`);
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "UQ_organizations_organization_number"`,
    );
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "organization_number"`);
  }
}
