import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Suspicious activity alerts (P8-03, PRO-08). `exams.alert_flags`: when a student reaches this
 * many flags, the teacher gets an alert (at most one per student every 5 minutes); null = no
 * alerts (every exam so far). Safe to run twice; logs a count check.
 */
export class ExamProctoringAlerts1756410000000 implements MigrationInterface {
  name = 'ExamProctoringAlerts1756410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "alert_flags" smallint`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_exams_alert_flags') THEN
          ALTER TABLE "exams" ADD CONSTRAINT "CHK_exams_alert_flags" CHECK ("alert_flags" IS NULL OR "alert_flags" BETWEEN 1 AND 100);
        END IF;
      END $$;
    `);
    const [counts] = await queryRunner.query(`SELECT count(*) FILTER (WHERE alert_flags IS NOT NULL)::int AS alerting FROM exams`);
    console.log(`[ExamProctoringAlerts] exams with alerts: ${counts.alerting}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "CHK_exams_alert_flags"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN IF EXISTS "alert_flags"`);
  }
}
