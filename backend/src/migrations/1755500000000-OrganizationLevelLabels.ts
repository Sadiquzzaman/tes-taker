import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Level names per organisation (P2-04, FND-03; design §9.1 `organizations.level_labels`).
 *
 * Expand only: a nullable jsonb column. NULL means the built-in names (Class / Section), so no row
 * is backfilled; the count check logs how many organisations use their own names. Safe to run twice.
 */
export class OrganizationLevelLabels1755500000000 implements MigrationInterface {
  name = 'OrganizationLevelLabels1755500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "level_labels" jsonb`);

    const [{ total, renamed }] = await queryRunner.query(
      `SELECT count(*)::int AS total, count("level_labels")::int AS renamed FROM "organizations"`,
    );
    console.log(`[OrganizationLevelLabels] organizations: ${total}, with their own level names: ${renamed}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "level_labels"`);
  }
}
