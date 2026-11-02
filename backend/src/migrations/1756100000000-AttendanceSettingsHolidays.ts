import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Attendance settings and holidays (P3-01, ATT-01, CAL-04; design §9.1 org_settings, §9.9 holidays).
 *
 * Adds the attendance columns to org_settings with the spec's defaults (daily presence Off, class
 * attendance per class session, Friday off, 9:00 / 8:45 entry times, every guardian SMS on, 3 days
 * for the repeated-absence alert); existing rows get the defaults and no other data is changed.
 * Creates `holidays` (a day or a range per organisation; removed rows are kept with is_active '0',
 * removed_at and removed_by). Safe to run twice; logs a count check.
 */
export class AttendanceSettingsHolidays1756100000000 implements MigrationInterface {
  name = 'AttendanceSettingsHolidays1756100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        ADD COLUMN IF NOT EXISTS "weekly_off_days" smallint array NOT NULL DEFAULT '{5}',
        ADD COLUMN IF NOT EXISTS "student_entry_time" TIME NOT NULL DEFAULT '09:00:00',
        ADD COLUMN IF NOT EXISTS "teacher_entry_time" TIME NOT NULL DEFAULT '08:45:00',
        ADD COLUMN IF NOT EXISTS "guardian_sms" jsonb NOT NULL DEFAULT '{"late": true, "leave": true, "absent": true}',
        ADD COLUMN IF NOT EXISTS "repeat_absence_days" smallint NOT NULL DEFAULT 3
    `);
    await this.addConstraint(queryRunner, 'org_settings', 'CHK_org_settings_repeat_absence_days',
      `CHECK ("repeat_absence_days" BETWEEN 2 AND 30)`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."holidays_is_active_enum" AS ENUM('1', '0');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "holidays" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" "public"."holidays_is_active_enum" NOT NULL DEFAULT '1',
        "created_by" uuid, "created_user_name" character varying(100),
        "updated_by" uuid, "updated_user_name" character varying(100),
        "created_at" TIMESTAMP, "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "date_from" date NOT NULL, "date_to" date NOT NULL,
        "name" character varying(120),
        "removed_at" TIMESTAMP WITH TIME ZONE, "removed_by" uuid,
        CONSTRAINT "CHK_holidays_date_range" CHECK ("date_to" >= "date_from"),
        CONSTRAINT "PK_3646bdd4c3817d954d830881dfe" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_holidays_organization_date_from" ON "holidays" ("organization_id", "date_from")`,
    );
    await this.addConstraint(queryRunner, 'holidays', 'FK_holidays_organization',
      `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM org_settings) AS settings,
        (SELECT count(*)::int FROM org_settings WHERE attendance_method = 'OFF') AS presence_off,
        (SELECT count(*)::int FROM holidays) AS holidays
    `);
    console.log(
      `[AttendanceSettingsHolidays] org_settings rows: ${counts.settings}, daily presence off: ${counts.presence_off}, holidays: ${counts.holidays}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "holidays"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."holidays_is_active_enum"`);
    await queryRunner.query(`ALTER TABLE "org_settings" DROP CONSTRAINT IF EXISTS "CHK_org_settings_repeat_absence_days"`);
    await queryRunner.query(`
      ALTER TABLE "org_settings"
        DROP COLUMN IF EXISTS "repeat_absence_days",
        DROP COLUMN IF EXISTS "guardian_sms",
        DROP COLUMN IF EXISTS "teacher_entry_time",
        DROP COLUMN IF EXISTS "student_entry_time",
        DROP COLUMN IF EXISTS "weekly_off_days",
        DROP COLUMN IF EXISTS "class_attendance_mode",
        DROP COLUMN IF EXISTS "selfie_required",
        DROP COLUMN IF EXISTS "attendance_method"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."class_attendance_mode"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."attendance_method"`);
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
