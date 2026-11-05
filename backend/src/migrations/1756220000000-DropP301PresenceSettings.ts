import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contract step of the P3-02 attendance rework (expand → contract, owner decision 5 Nov 2026;
 * dropped on the owner's approval 6 Nov 2026: production does not use attendance yet).
 *
 * Drops P3-01's org_settings columns that the class-based design replaced and that nothing has
 * read or written since P3-02 (#163): `attendance_method`, `selfie_required`,
 * `class_attendance_mode`, `student_entry_time`, `teacher_entry_time`, and the
 * `attendance_method` and `class_attendance_mode` types. `weekly_off_days`, `guardian_sms`,
 * `repeat_absence_days` and `late_grace_minutes` stay. Down adds the columns back with their
 * defaults (values are not restored; all were the defaults on beta, checked before the drop).
 * Safe to run twice; logs a count check.
 */
export class DropP301PresenceSettings1756220000000 implements MigrationInterface {
  name = 'DropP301PresenceSettings1756220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: { column_name: string }[] = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'org_settings'
        AND column_name IN ('attendance_method', 'selfie_required', 'class_attendance_mode', 'student_entry_time', 'teacher_entry_time')
    `);
    // Rows that held anything other than the defaults, for the log (none expected).
    let changed = 0;
    if (columns.length === 5) {
      const [row] = await queryRunner.query(`
        SELECT count(*)::int AS changed FROM org_settings
        WHERE attendance_method <> 'OFF' OR selfie_required OR class_attendance_mode <> 'PER_SESSION'
           OR student_entry_time <> '09:00' OR teacher_entry_time <> '08:45'
      `);
      changed = row.changed;
    }
    await queryRunner.query(`
      ALTER TABLE "org_settings"
        DROP COLUMN IF EXISTS "attendance_method",
        DROP COLUMN IF EXISTS "selfie_required",
        DROP COLUMN IF EXISTS "class_attendance_mode",
        DROP COLUMN IF EXISTS "student_entry_time",
        DROP COLUMN IF EXISTS "teacher_entry_time"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."attendance_method"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."class_attendance_mode"`);

    const [counts] = await queryRunner.query(`SELECT count(*)::int AS settings FROM org_settings`);
    console.log(
      `[DropP301PresenceSettings] org_settings rows: ${counts.settings}, columns dropped: ${columns.length}, rows with non-default values: ${changed}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."attendance_method" AS ENUM('OFF', 'WEB', 'ZKTECO', 'APP');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."class_attendance_mode" AS ENUM('OFF', 'PER_SESSION', 'DAILY');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "org_settings"
        ADD COLUMN IF NOT EXISTS "attendance_method" "public"."attendance_method" NOT NULL DEFAULT 'OFF',
        ADD COLUMN IF NOT EXISTS "selfie_required" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "class_attendance_mode" "public"."class_attendance_mode" NOT NULL DEFAULT 'PER_SESSION',
        ADD COLUMN IF NOT EXISTS "student_entry_time" TIME NOT NULL DEFAULT '09:00:00',
        ADD COLUMN IF NOT EXISTS "teacher_entry_time" TIME NOT NULL DEFAULT '08:45:00'
    `);
  }
}
