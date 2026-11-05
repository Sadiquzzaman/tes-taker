import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Branches and the organisation grace period (P3-02, ATT-15, ATT-01 as changed on 5 Nov 2026;
 * design §9.4 "Class-based design").
 *
 * Creates `branches` (pin, check-in radius 25–1000 m, a hidden default branch per organisation;
 * removed rows are kept with is_active '0', removed_at and removed_by) and gives every existing
 * organisation its default branch, with no pin and a 100 m radius. Adds `sections.branch_id`
 * (null = the organisation's default branch, so no section row is changed) and
 * `org_settings.late_grace_minutes` (0–60, default 10).
 *
 * P3-01's daily presence method, selfie, class attendance mode and entry times are no longer used
 * from P3-02 on, but their columns stay until a later release drops them (expand → contract, owner
 * decision 5 Nov 2026). Safe to run twice; logs a count check.
 */
export class AttendanceBranches1756200000000 implements MigrationInterface {
  name = 'AttendanceBranches1756200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."branches_is_active_enum" AS ENUM('1', '0');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "branches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" "public"."branches_is_active_enum" NOT NULL DEFAULT '1',
        "created_by" uuid, "created_user_name" character varying(100),
        "updated_by" uuid, "updated_user_name" character varying(100),
        "created_at" TIMESTAMP, "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "name" character varying(120),
        "address" text,
        "geo_lat" numeric(9,6), "geo_lng" numeric(9,6),
        "checkin_radius_m" integer NOT NULL DEFAULT 100,
        "is_default" boolean NOT NULL DEFAULT false,
        "removed_at" TIMESTAMP WITH TIME ZONE, "removed_by" uuid,
        CONSTRAINT "CHK_branches_radius" CHECK ("checkin_radius_m" BETWEEN 25 AND 1000),
        CONSTRAINT "CHK_branches_pin" CHECK (("geo_lat" IS NULL) = ("geo_lng" IS NULL)),
        CONSTRAINT "CHK_branches_name" CHECK ("name" IS NOT NULL OR "is_default"),
        CONSTRAINT "PK_branches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_branches_organization" ON "branches" ("organization_id")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_branches_default" ON "branches" ("organization_id") WHERE "is_default"`,
    );
    await this.addConstraint(queryRunner, 'branches', 'FK_branches_organization',
      `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    // Every organisation gets its hidden default branch (no pin yet; the radius default is 100 m).
    await queryRunner.query(`
      INSERT INTO "branches" ("organization_id", "is_default", "created_at")
      SELECT o.id, true, now() FROM "organizations" o
      ON CONFLICT ("organization_id") WHERE "is_default" DO NOTHING
    `);

    await queryRunner.query(`ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sections_branch" ON "sections" ("branch_id")`);
    await this.addConstraint(queryRunner, 'sections', 'FK_sections_branch',
      `FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    await queryRunner.query(
      `ALTER TABLE "org_settings" ADD COLUMN IF NOT EXISTS "late_grace_minutes" smallint NOT NULL DEFAULT 10`,
    );
    await this.addConstraint(queryRunner, 'org_settings', 'CHK_org_settings_late_grace_minutes',
      `CHECK ("late_grace_minutes" BETWEEN 0 AND 60)`);

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM organizations) AS organizations,
        (SELECT count(*)::int FROM branches WHERE is_default) AS default_branches,
        (SELECT count(*)::int FROM sections) AS sections,
        (SELECT count(*)::int FROM sections WHERE branch_id IS NULL) AS sections_on_default
    `);
    console.log(
      `[AttendanceBranches] organisations: ${counts.organizations}, default branches: ${counts.default_branches}, ` +
        `sections: ${counts.sections} (on the default branch: ${counts.sections_on_default})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_settings" DROP CONSTRAINT IF EXISTS "CHK_org_settings_late_grace_minutes"`);
    await queryRunner.query(`ALTER TABLE "org_settings" DROP COLUMN IF EXISTS "late_grace_minutes"`);
    await queryRunner.query(`ALTER TABLE "sections" DROP CONSTRAINT IF EXISTS "FK_sections_branch"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sections_branch"`);
    await queryRunner.query(`ALTER TABLE "sections" DROP COLUMN IF EXISTS "branch_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "branches"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."branches_is_active_enum"`);
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
