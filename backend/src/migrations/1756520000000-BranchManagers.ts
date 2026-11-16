import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Branches on or off, and branch managers (P12-01, FND-06).
 *
 * - The member and invitation role enums get `BRANCH_MANAGER`.
 * - `organization_members.branch_id`: the one branch a branch manager runs (null for every other role).
 * - `org_settings.branches_enabled`: off = only the hidden main branch is used; switched on here for
 *   organisations that already have a branch besides the main one.
 *
 * Safe to run twice; logs a count check. `down` drops the columns; an enum value cannot be removed
 * from PostgreSQL, so `BRANCH_MANAGER` stays in the enums (unused once the code is reverted).
 */
export class BranchManagers1756520000000 implements MigrationInterface {
  name = 'BranchManagers1756520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "organization_members_role_enum" ADD VALUE IF NOT EXISTS 'BRANCH_MANAGER'`);
    await queryRunner.query(`ALTER TYPE "organization_invitations_role_enum" ADD VALUE IF NOT EXISTS 'BRANCH_MANAGER'`);
    await queryRunner.query(`ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organization_members_branch" ON "organization_members" ("branch_id")`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_organization_members_branch') THEN
          ALTER TABLE "organization_members" ADD CONSTRAINT "FK_organization_members_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`ALTER TABLE "org_settings" ADD COLUMN IF NOT EXISTS "branches_enabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`
      UPDATE org_settings s SET branches_enabled = true
      WHERE NOT s.branches_enabled
        AND EXISTS (SELECT 1 FROM branches b WHERE b.organization_id = s.organization_id AND NOT b.is_default AND b.is_active = '1')
    `);
    const [counts] = await queryRunner.query(`
      SELECT (SELECT count(*) FROM org_settings WHERE branches_enabled)::int AS with_branches,
             (SELECT count(*) FROM organization_members WHERE branch_id IS NOT NULL)::int AS branch_managers
    `);
    console.log(`[BranchManagers] organisations with branches: ${counts.with_branches}, branch managers: ${counts.branch_managers}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_settings" DROP COLUMN IF EXISTS "branches_enabled"`);
    await queryRunner.query(`ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "FK_organization_members_branch"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organization_members_branch"`);
    await queryRunner.query(`ALTER TABLE "organization_members" DROP COLUMN IF EXISTS "branch_id"`);
  }
}
