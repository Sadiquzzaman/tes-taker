import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Proctoring level per exam (P8-01, PRO-01, PRO-02). Owned by the exams module.
 *
 * `exams` gains:
 * - `proctoring_level`: OFF, LIGHT (browser checks) or STRICT (plus camera, microphone, phone);
 * - `proctoring_checks_off`: checks the teacher switched off within the level;
 * - `auto_disqualify`, `disqualify_threshold`, `disqualify_checks`: auto-disqualification is now
 *   the teacher's choice, off for new exams, with the number of flags and which checks count.
 *
 * Existing exams keep what they had before P8: STRICT, auto-disqualify on at 15 flags of any
 * check (the old fixed rule), so nothing changes for exams already set. Safe to run twice; logs a
 * count check.
 */
export class ExamProctoringSettings1756390000000 implements MigrationInterface {
  name = 'ExamProctoringSettings1756390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ exists }] = await queryRunner.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'auto_disqualify') AS exists`,
    );
    await queryRunner.query(`
      ALTER TABLE "exams"
        ADD COLUMN IF NOT EXISTS "proctoring_level" character varying(10) NOT NULL DEFAULT 'STRICT',
        ADD COLUMN IF NOT EXISTS "proctoring_checks_off" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "auto_disqualify" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "disqualify_threshold" smallint NOT NULL DEFAULT 15,
        ADD COLUMN IF NOT EXISTS "disqualify_checks" jsonb
    `);
    // The exams that existed keep auto-disqualification at 15 flags, as before (only on the first run).
    if (!exists) await queryRunner.query(`UPDATE "exams" SET "auto_disqualify" = true`);
    await this.addConstraint(queryRunner, 'CHK_exams_proctoring_level', `CHECK ("proctoring_level" IN ('OFF', 'LIGHT', 'STRICT'))`);
    await this.addConstraint(queryRunner, 'CHK_exams_disqualify_threshold', `CHECK ("disqualify_threshold" BETWEEN 1 AND 100)`);

    const [counts] = await queryRunner.query(`
      SELECT count(*)::int AS exams, count(*) FILTER (WHERE auto_disqualify)::int AS auto_disqualify FROM exams
    `);
    console.log(`[ExamProctoringSettings] exams: ${counts.exams}, auto-disqualify on: ${counts.auto_disqualify}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "CHK_exams_disqualify_threshold"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "CHK_exams_proctoring_level"`);
    await queryRunner.query(`
      ALTER TABLE "exams"
        DROP COLUMN IF EXISTS "disqualify_checks",
        DROP COLUMN IF EXISTS "disqualify_threshold",
        DROP COLUMN IF EXISTS "auto_disqualify",
        DROP COLUMN IF EXISTS "proctoring_checks_off",
        DROP COLUMN IF EXISTS "proctoring_level"
    `);
  }

  private async addConstraint(queryRunner: QueryRunner, name: string, definition: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "exams" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$;
    `);
  }
}
