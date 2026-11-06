import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Earlier weekly off days (org_settings.weekly_off_days_history), found in the P3 beta walkthrough:
 * opening a weekly off day made the closing job save Absent for that day's classes that had
 * already happened, because closed days were worked out from today's settings only.
 *
 * Expand only: a jsonb list, empty for every organisation (nothing earlier is known, so behaviour is
 * unchanged until the next change of off days). Safe to run twice; logs a count check.
 */
export class WeeklyOffDaysHistory1756260000000 implements MigrationInterface {
  name = 'WeeklyOffDaysHistory1756260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "org_settings" ADD COLUMN IF NOT EXISTS "weekly_off_days_history" jsonb NOT NULL DEFAULT '[]'`,
    );

    const [counts] = await queryRunner.query(`
      SELECT count(*)::int AS settings, count(*) FILTER (WHERE weekly_off_days_history = '[]'::jsonb)::int AS empty
      FROM org_settings
    `);
    console.log(`[WeeklyOffDaysHistory] org_settings rows: ${counts.settings}, with an empty history: ${counts.empty}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_settings" DROP COLUMN IF EXISTS "weekly_off_days_history"`);
  }
}
