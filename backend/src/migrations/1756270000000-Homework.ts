import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Homework (P5-01, HW-01, HW-02; design §9.5).
 *
 * Creates, owned by the homework module:
 * - `homework`: one homework for one subject of one session, with rich-text instructions, how it is
 *   handed in (FILE, TEXT, PAPER), total marks, due time, status (DRAFT, SCHEDULED, PUBLISHED,
 *   CANCELLED; never deleted), when it was or will be published, and when its 24-hour reminder went.
 * - `homework_targets`: the subject classes it is set to, or chosen students of them.
 * - `homework_attachments`: the teacher's files on it, in order.
 *
 * New empty tables only; no existing row changes. Safe to run twice; logs a count check.
 */
export class Homework1756270000000 implements MigrationInterface {
  name = 'Homework1756270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [type, values] of [
      ['homework_is_active_enum', `'1', '0'`],
      ['homework_type', `'FILE', 'TEXT', 'PAPER'`],
      ['homework_status', `'DRAFT', 'SCHEDULED', 'PUBLISHED', 'CANCELLED'`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."${type}" AS ENUM(${values});
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homework" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" "public"."homework_is_active_enum" NOT NULL DEFAULT '1',
        "created_by" uuid, "created_user_name" character varying(100),
        "updated_by" uuid, "updated_user_name" character varying(100),
        "created_at" TIMESTAMP, "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "subject_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "instructions" jsonb,
        "submission_type" "public"."homework_type" NOT NULL,
        "total_marks" numeric(6,2),
        "due_at" TIMESTAMP WITH TIME ZONE,
        "publish_at" TIMESTAMP WITH TIME ZONE,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "status" "public"."homework_status" NOT NULL DEFAULT 'DRAFT',
        "reminder_sent_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_by" uuid,
        CONSTRAINT "PK_homework" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_homework_org_status_due" ON "homework" ("organization_id", "status", "due_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_homework_org_session" ON "homework" ("organization_id", "session_id")`);
    await this.addConstraint(queryRunner, 'homework', 'FK_homework_session',
      `FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'homework', 'FK_homework_subject',
      `FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homework_targets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "homework_id" uuid NOT NULL,
        "offering_id" uuid NOT NULL,
        "student_id" uuid,
        CONSTRAINT "PK_homework_targets" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_homework_targets_homework" ON "homework_targets" ("homework_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_homework_targets_offering" ON "homework_targets" ("offering_id")`);
    await this.addConstraint(queryRunner, 'homework_targets', 'FK_homework_targets_homework',
      `FOREIGN KEY ("homework_id") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'homework_targets', 'FK_homework_targets_offering',
      `FOREIGN KEY ("offering_id") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'homework_targets', 'FK_homework_targets_student',
      `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homework_attachments" (
        "homework_id" uuid NOT NULL,
        "file_id" uuid NOT NULL,
        "sort_order" smallint NOT NULL DEFAULT 0,
        CONSTRAINT "PK_homework_attachments" PRIMARY KEY ("homework_id", "file_id")
      )
    `);
    await this.addConstraint(queryRunner, 'homework_attachments', 'FK_homework_attachments_homework',
      `FOREIGN KEY ("homework_id") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'homework_attachments', 'FK_homework_attachments_file',
      `FOREIGN KEY ("file_id") REFERENCES "file_objects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM homework) AS homework,
        (SELECT count(*)::int FROM homework_targets) AS targets,
        (SELECT count(*)::int FROM homework_attachments) AS attachments
    `);
    console.log(`[Homework] homework: ${counts.homework}, targets: ${counts.targets}, attachments: ${counts.attachments}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "homework_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "homework_targets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "homework"`);
    for (const type of ['homework_status', 'homework_type', 'homework_is_active_enum']) {
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
