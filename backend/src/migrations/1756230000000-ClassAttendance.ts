import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Class attendance (P3-03, ATT-04/06/07/11/12; design §9.4 "Class-based design").
 *
 * Creates, owned by attendance:
 * - `class_attendance`: one row per class session (a section meeting on a date from a routine
 *   slot), with its start and end as UTC instants and a status (P3-04 adds closing and
 *   cancellation). Unique per slot and date.
 * - `class_attendance_records`: one row per student or teacher per session: status, server check-in
 *   time, minutes late, source, and for in-person check-ins the position, distance, accuracy and a
 *   flag when it looks odd. A plain table for now (partitioning by month: docs/TODO.md).
 * - `attendance_corrections`: every correction with the old and new status, the reason, who and when.
 *
 * All three are new and empty, so no existing row is changed. Safe to run twice; logs a count check.
 */
export class ClassAttendance1756230000000 implements MigrationInterface {
  name = 'ClassAttendance1756230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [type, values] of [
      ['class_session_status', `'SCHEDULED', 'CLOSED', 'CANCELLED'`],
      ['attendance_status', `'PRESENT', 'LATE', 'ABSENT', 'LEAVE'`],
      ['attendance_person_type', `'STUDENT', 'TEACHER'`],
      ['attendance_record_source', `'SELF', 'AUTO_ABSENT', 'IMPORT', 'CORRECTION'`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."${type}" AS ENUM(${values});
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_attendance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "section_id" uuid NOT NULL,
        "routine_slot_id" uuid NOT NULL,
        "date" date NOT NULL,
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" "public"."class_session_status" NOT NULL DEFAULT 'SCHEDULED',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_class_attendance_times" CHECK ("ends_at" > "starts_at"),
        CONSTRAINT "PK_class_attendance" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_class_attendance_slot_date" ON "class_attendance" ("routine_slot_id", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_class_attendance_section_date" ON "class_attendance" ("organization_id", "section_id", "date")`,
    );
    await this.addConstraint(queryRunner, 'class_attendance', 'FK_class_attendance_section',
      `FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'class_attendance', 'FK_class_attendance_slot',
      `FOREIGN KEY ("routine_slot_id") REFERENCES "routine_slots"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_attendance_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "class_attendance_id" uuid NOT NULL,
        "date" date NOT NULL,
        "person_id" uuid NOT NULL,
        "person_type" "public"."attendance_person_type" NOT NULL,
        "status" "public"."attendance_status" NOT NULL,
        "checked_in_at" TIMESTAMP WITH TIME ZONE,
        "late_minutes" smallint,
        "source" "public"."attendance_record_source" NOT NULL,
        "geo_lat" numeric(9,6),
        "geo_lng" numeric(9,6),
        "distance_m" integer,
        "accuracy_m" integer,
        "flag" character varying(40),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE,
        "updated_by" uuid,
        CONSTRAINT "CHK_class_attendance_records_late" CHECK ("late_minutes" IS NULL OR "late_minutes" >= 0),
        CONSTRAINT "PK_class_attendance_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_class_attendance_records_person" ON "class_attendance_records" ("class_attendance_id", "person_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_class_attendance_records_person_date" ON "class_attendance_records" ("organization_id", "person_id", "date")`,
    );
    await this.addConstraint(queryRunner, 'class_attendance_records', 'FK_class_attendance_records_session',
      `FOREIGN KEY ("class_attendance_id") REFERENCES "class_attendance"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'class_attendance_records', 'FK_class_attendance_records_person',
      `FOREIGN KEY ("person_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "attendance_corrections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "record_id" uuid NOT NULL,
        "old_status" "public"."attendance_status",
        "new_status" "public"."attendance_status" NOT NULL,
        "reason" text NOT NULL,
        "corrected_by" uuid,
        "correction_sms_sent" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendance_corrections" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendance_corrections_record" ON "attendance_corrections" ("record_id", "created_at")`,
    );
    await this.addConstraint(queryRunner, 'attendance_corrections', 'FK_attendance_corrections_record',
      `FOREIGN KEY ("record_id") REFERENCES "class_attendance_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'attendance_corrections', 'FK_attendance_corrections_corrected_by',
      `FOREIGN KEY ("corrected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM routine_slots) AS slots,
        (SELECT count(*)::int FROM class_attendance) AS sessions,
        (SELECT count(*)::int FROM class_attendance_records) AS records,
        (SELECT count(*)::int FROM attendance_corrections) AS corrections
    `);
    console.log(
      `[ClassAttendance] routine slots: ${counts.slots}, class sessions: ${counts.sessions}, records: ${counts.records}, corrections: ${counts.corrections}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_corrections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_attendance_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_attendance"`);
    for (const type of ['attendance_record_source', 'attendance_person_type', 'attendance_status', 'class_session_status']) {
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
