import { MigrationInterface, QueryRunner } from 'typeorm';

/** Organisations that already have classes: they set up their structure before the wizard existed. */
const HAS_CLASSES = `EXISTS (SELECT 1 FROM classes c WHERE c.organization_id = o.id)`;

/**
 * When an organisation finished the academic setup wizard (P2-04, FND-02): org_settings.setup_completed_at.
 *
 * Expand: a nullable timestamptz column. Migrate: organisations that already have classes count as
 * set up, so existing schools never see the wizard banner (a settings row is created where missing,
 * with the P2-03 default for class teachers). Safe to run twice; logs a count check.
 */
export class OrgSetupCompleted1755510000000 implements MigrationInterface {
  name = 'OrgSetupCompleted1755510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_settings" ADD COLUMN IF NOT EXISTS "setup_completed_at" TIMESTAMP WITH TIME ZONE`);

    await queryRunner.query(`
      INSERT INTO org_settings (organization_id, class_teacher_enabled, created_user_name, created_at, is_active)
      SELECT o.id, o.kind <> 'SOLO', 'Migration P2-04', now(), '1'
      FROM organizations o
      WHERE ${HAS_CLASSES} AND NOT EXISTS (SELECT 1 FROM org_settings s WHERE s.organization_id = o.id)
    `);
    await queryRunner.query(`
      UPDATE org_settings s SET setup_completed_at = now()
      FROM organizations o
      WHERE o.id = s.organization_id AND s.setup_completed_at IS NULL AND ${HAS_CLASSES}
    `);

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM organizations o WHERE ${HAS_CLASSES}) AS with_classes,
        (SELECT count(*)::int FROM org_settings WHERE setup_completed_at IS NOT NULL) AS set_up
    `);
    console.log(`[OrgSetupCompleted] organisations with classes: ${counts.with_classes}, marked as set up: ${counts.set_up}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Settings rows created by up() stay: they hold only the defaults.
    await queryRunner.query(`ALTER TABLE "org_settings" DROP COLUMN IF EXISTS "setup_completed_at"`);
  }
}
