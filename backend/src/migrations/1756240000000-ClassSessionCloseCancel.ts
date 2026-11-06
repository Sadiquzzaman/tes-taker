import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Closing and cancelling class sessions (P3-04, ATT-10, ATT-19; design §9.4 "Class-based design").
 *
 * Adds to `class_attendance` (owned by attendance):
 * - `closed_at`: when the closing job saved the Absent records and set the status CLOSED.
 * - `cancelled_at`, `cancelled_by` and `cancel_note`: a teacher or admin cancelled the class for
 *   that day (status CANCELLED); restoring it clears them (the audit log keeps the history).
 * - An index on (organization_id, date, status) for the closing and end-of-day jobs.
 *
 * The status values CLOSED and CANCELLED already exist (P3-03's type). Only nullable columns are
 * added, so no existing row changes. Safe to run twice; logs a count check.
 */
export class ClassSessionCloseCancel1756240000000 implements MigrationInterface {
  name = 'ClassSessionCloseCancel1756240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "class_attendance" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "class_attendance" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "class_attendance" ADD COLUMN IF NOT EXISTS "cancelled_by" uuid`);
    await queryRunner.query(`ALTER TABLE "class_attendance" ADD COLUMN IF NOT EXISTS "cancel_note" character varying(300)`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_class_attendance_cancelled_by') THEN
          ALTER TABLE "class_attendance" ADD CONSTRAINT "FK_class_attendance_cancelled_by"
            FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_class_attendance_org_date_status" ON "class_attendance" ("organization_id", "date", "status")`,
    );

    const [counts] = await queryRunner.query(`
      SELECT
        count(*)::int AS sessions,
        count(*) FILTER (WHERE status = 'SCHEDULED')::int AS scheduled,
        count(*) FILTER (WHERE status = 'CLOSED')::int AS closed,
        count(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled
      FROM class_attendance
    `);
    console.log(
      `[ClassSessionCloseCancel] class sessions: ${counts.sessions} (scheduled ${counts.scheduled}, closed ${counts.closed}, cancelled ${counts.cancelled})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Sessions closed or cancelled under P3-04 go back to SCHEDULED, the only status P3-03 used;
    // their records stay.
    await queryRunner.query(`UPDATE "class_attendance" SET "status" = 'SCHEDULED' WHERE "status" <> 'SCHEDULED'`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_class_attendance_org_date_status"`);
    await queryRunner.query(`ALTER TABLE "class_attendance" DROP CONSTRAINT IF EXISTS "FK_class_attendance_cancelled_by"`);
    for (const column of ['cancel_note', 'cancelled_by', 'cancelled_at', 'closed_at']) {
      await queryRunner.query(`ALTER TABLE "class_attendance" DROP COLUMN IF EXISTS "${column}"`);
    }
  }
}
