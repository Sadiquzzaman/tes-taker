import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Leave requests (P3-06, ATT-09, ATT-11; design §9.4).
 *
 * Creates, owned by attendance:
 * - `leave_requests`: a student's or teacher's leave from one school date to another, with the
 *   reason, an optional attachment, the status (PENDING, APPROVED, REJECTED, CANCELLED; never
 *   deleted), who applied, who decided and when, and who cancelled it.
 * Adds to `class_attendance_records` (owned by attendance):
 * - `leave_request_id`: the approved request behind a LEAVE record (nullable; set null if the
 *   request row ever goes).
 *
 * A new empty table and a nullable column, so no existing row changes. The person type has its own
 * enum (`leave_person_type`) so that ClassAttendance's down can still drop `attendance_person_type`.
 * Safe to run twice; logs a count check.
 */
export class LeaveRequests1756250000000 implements MigrationInterface {
  name = 'LeaveRequests1756250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [type, values] of [
      ['leave_status', `'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'`],
      ['leave_person_type', `'STUDENT', 'TEACHER'`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."${type}" AS ENUM(${values});
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leave_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "person_id" uuid NOT NULL,
        "person_type" "public"."leave_person_type" NOT NULL,
        "from_date" date NOT NULL,
        "to_date" date NOT NULL,
        "reason" text NOT NULL,
        "file_id" uuid,
        "status" "public"."leave_status" NOT NULL DEFAULT 'PENDING',
        "applied_by" uuid,
        "approver_id" uuid,
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "decision_note" text,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "CHK_leave_requests_dates" CHECK ("to_date" >= "from_date"),
        CONSTRAINT "PK_leave_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_leave_requests_person_from" ON "leave_requests" ("organization_id", "person_id", "from_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_leave_requests_org_status" ON "leave_requests" ("organization_id", "status", "from_date")`,
    );
    await this.addConstraint(queryRunner, 'leave_requests', 'FK_leave_requests_person',
      `FOREIGN KEY ("person_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'leave_requests', 'FK_leave_requests_file',
      `FOREIGN KEY ("file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    for (const [column, name] of [
      ['applied_by', 'FK_leave_requests_applied_by'],
      ['approver_id', 'FK_leave_requests_approver'],
      ['cancelled_by', 'FK_leave_requests_cancelled_by'],
    ]) {
      await this.addConstraint(queryRunner, 'leave_requests', name,
        `FOREIGN KEY ("${column}") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    await queryRunner.query(`ALTER TABLE "class_attendance_records" ADD COLUMN IF NOT EXISTS "leave_request_id" uuid`);
    await this.addConstraint(queryRunner, 'class_attendance_records', 'FK_class_attendance_records_leave_request',
      `FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM leave_requests) AS requests,
        (SELECT count(*)::int FROM class_attendance_records) AS records,
        (SELECT count(*)::int FROM class_attendance_records WHERE status = 'LEAVE') AS leave_records
    `);
    console.log(
      `[LeaveRequests] leave requests: ${counts.requests}, attendance records: ${counts.records} (leave ${counts.leave_records})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // LEAVE records stay LEAVE (P3-03's status); only their link to the request goes.
    await queryRunner.query(`ALTER TABLE "class_attendance_records" DROP CONSTRAINT IF EXISTS "FK_class_attendance_records_leave_request"`);
    await queryRunner.query(`ALTER TABLE "class_attendance_records" DROP COLUMN IF EXISTS "leave_request_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_requests"`);
    for (const type of ['leave_person_type', 'leave_status']) {
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
