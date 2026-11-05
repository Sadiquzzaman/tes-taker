import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section attendance setup and schedules (P3-02, ATT-16; design §9.4 "Class-based design").
 *
 * Creates `section_attendance_settings` (owned by attendance: in person / online, self check-in /
 * paper register, an own grace period or null for the organisation's; a section without a row
 * uses the defaults) and `routine_slots` (owned by calendar: the weekly slots a section meets in,
 * which the P5 routine reuses; removed slots are kept with is_active '0', removed_at and
 * removed_by). Both are new and empty, so no existing row is changed. Safe to run twice; logs a
 * count check.
 */
export class SectionSchedules1756210000000 implements MigrationInterface {
  name = 'SectionSchedules1756210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [type, values] of [
      ['section_class_type', `'IN_PERSON', 'ONLINE'`],
      ['section_attendance_mode', `'SELF_CHECKIN', 'PAPER_REGISTER'`],
      ['section_attendance_settings_is_active_enum', `'1', '0'`],
      ['routine_slots_is_active_enum', `'1', '0'`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."${type}" AS ENUM(${values});
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "section_attendance_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" "public"."section_attendance_settings_is_active_enum" NOT NULL DEFAULT '1',
        "created_by" uuid, "created_user_name" character varying(100),
        "updated_by" uuid, "updated_user_name" character varying(100),
        "created_at" TIMESTAMP, "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "section_id" uuid NOT NULL,
        "class_type" "public"."section_class_type" NOT NULL DEFAULT 'IN_PERSON',
        "mode" "public"."section_attendance_mode" NOT NULL DEFAULT 'SELF_CHECKIN',
        "grace_minutes" smallint,
        CONSTRAINT "CHK_section_attendance_settings_grace" CHECK ("grace_minutes" IS NULL OR "grace_minutes" BETWEEN 0 AND 60),
        CONSTRAINT "PK_section_attendance_settings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_section_attendance_settings_section" ON "section_attendance_settings" ("section_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_section_attendance_settings_organization" ON "section_attendance_settings" ("organization_id")`,
    );
    await this.addConstraint(queryRunner, 'section_attendance_settings', 'FK_section_attendance_settings_section',
      `FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "routine_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" "public"."routine_slots_is_active_enum" NOT NULL DEFAULT '1',
        "created_by" uuid, "created_user_name" character varying(100),
        "updated_by" uuid, "updated_user_name" character varying(100),
        "created_at" TIMESTAMP, "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "section_id" uuid NOT NULL,
        "offering_id" uuid,
        "teacher_id" uuid,
        "room" character varying(40),
        "day_of_week" smallint NOT NULL,
        "start_time" TIME NOT NULL,
        "end_time" TIME NOT NULL,
        "valid_from" date, "valid_to" date,
        "removed_at" TIMESTAMP WITH TIME ZONE, "removed_by" uuid,
        CONSTRAINT "CHK_routine_slots_day" CHECK ("day_of_week" BETWEEN 1 AND 7),
        CONSTRAINT "CHK_routine_slots_times" CHECK ("end_time" > "start_time"),
        CONSTRAINT "PK_routine_slots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_routine_slots_section_day" ON "routine_slots" ("section_id", "day_of_week", "start_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_routine_slots_teacher_day" ON "routine_slots" ("teacher_id", "day_of_week", "start_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_routine_slots_organization_session" ON "routine_slots" ("organization_id", "session_id")`,
    );
    await this.addConstraint(queryRunner, 'routine_slots', 'FK_routine_slots_session',
      `FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'routine_slots', 'FK_routine_slots_section',
      `FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'routine_slots', 'FK_routine_slots_offering',
      `FOREIGN KEY ("offering_id") REFERENCES "course_offerings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'routine_slots', 'FK_routine_slots_teacher',
      `FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM sections) AS sections,
        (SELECT count(*)::int FROM section_attendance_settings) AS settings,
        (SELECT count(*)::int FROM routine_slots) AS slots
    `);
    console.log(
      `[SectionSchedules] sections: ${counts.sections}, section attendance settings: ${counts.settings}, routine slots: ${counts.slots}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "routine_slots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "section_attendance_settings"`);
    for (const type of ['routine_slots_is_active_enum', 'section_attendance_settings_is_active_enum', 'section_attendance_mode', 'section_class_type']) {
      await queryRunner.query(`DROP TYPE IF EXISTS "public"."${type}"`);
    }
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
