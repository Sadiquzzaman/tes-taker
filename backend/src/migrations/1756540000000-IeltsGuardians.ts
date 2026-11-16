import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guardians on or off (P12-03, IEL-12): `org_settings.guardians_enabled`, null = the default for the
 * workspace type (on for Academic, off for IELTS, whose students are mostly adults).
 *
 * A new nullable column; no row changes. Safe to run twice; logs a count check.
 */
export class IeltsGuardians1756540000000 implements MigrationInterface {
  name = 'IeltsGuardians1756540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_settings" ADD COLUMN IF NOT EXISTS "guardians_enabled" boolean`);
    const [counts] = await queryRunner.query(`SELECT (SELECT count(*) FROM org_settings WHERE guardians_enabled IS NOT NULL)::int AS set`);
    console.log(`[IeltsGuardians] organisations with the switch set: ${counts.set}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_settings" DROP COLUMN IF EXISTS "guardians_enabled"`);
  }
}
