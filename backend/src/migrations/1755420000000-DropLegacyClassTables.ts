import { MigrationInterface, QueryRunner } from 'typeorm';

const BASE = `
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "created_by" uuid, "created_user_name" character varying(100),
  "updated_by" uuid, "updated_user_name" character varying(100),
  "created_at" TIMESTAMP, "updated_at" TIMESTAMP`;

/**
 * P2-03 contract step (design §12, owner decision to do it now): drops the legacy class tables that
 * enrolments and subject class teachers replaced — class_students (read-only since P2-03 part 2a),
 * class_teachers and class_subject_teachers (no longer written since part 3b).
 *
 * Count check before dropping: every class_students row must exist in enrolments (same id), or the
 * migration stops and drops nothing. Teacher links are only logged: since part 3b teachers are
 * removed on subject classes only, so a legacy link can rightly be missing from offering_teachers.
 *
 * down() recreates the tables and refills class_students from current enrolments and
 * class_subject_teachers from subject class teachers (open sessions); class_teachers stays empty
 * (a class teacher without a subject has no record of its own any more).
 */
export class DropLegacyClassTables1755420000000 implements MigrationInterface {
  name = 'DropLegacyClassTables1755420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ present }] = await queryRunner.query(`SELECT to_regclass('public.class_students') IS NOT NULL AS present`);
    if (!present) {
      console.log('[DropLegacyClassTables] already dropped');
      return;
    }

    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT COUNT(*) FROM class_students)::int AS class_students,
        (SELECT COUNT(*) FROM class_students cs WHERE NOT EXISTS (SELECT 1 FROM enrolments e WHERE e.id = cs.id))::int AS students_missing,
        (SELECT COUNT(*) FROM class_subject_teachers)::int AS subject_teachers,
        (SELECT COUNT(*) FROM class_subject_teachers cst JOIN class_subjects cs ON cs.id = cst.class_subject_id
          WHERE NOT EXISTS (
            SELECT 1 FROM offering_teachers ot JOIN course_offerings o ON o.id = ot.offering_id JOIN sections s ON s.id = o.section_id
            WHERE s.class_id = cs.class_id AND o.subject_id = cs.subject_id AND ot.teacher_id = cst.teacher_id
          ))::int AS subject_teachers_not_in_subject_classes,
        (SELECT COUNT(*) FROM class_teachers)::int AS class_teachers
    `);
    console.log('[DropLegacyClassTables] before drop:', counts);
    if (counts.students_missing > 0) {
      throw new Error(`[DropLegacyClassTables] ${counts.students_missing} class_students rows have no enrolment; nothing dropped`);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS "class_subject_teachers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_teachers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_students"`);
    for (const type of [
      'class_subject_teachers_is_active_enum',
      'class_teachers_is_active_enum',
      'class_students_status_enum',
      'class_students_is_active_enum',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "public"."${type}"`);
    }
    console.log('[DropLegacyClassTables] dropped class_students, class_teachers, class_subject_teachers');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [name, values] of [
      ['class_students_is_active_enum', `'1', '0'`],
      ['class_students_status_enum', `'INVITED', 'PENDING', 'JOINED'`],
      ['class_teachers_is_active_enum', `'1', '0'`],
      ['class_subject_teachers_is_active_enum', `'1', '0'`],
    ]) {
      await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."${name}" AS ENUM(${values}); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_students" (${BASE},
        "is_active" "public"."class_students_is_active_enum" NOT NULL DEFAULT '1',
        "class_id" uuid NOT NULL, "student_id" uuid,
        "status" "public"."class_students_status_enum" NOT NULL DEFAULT 'INVITED',
        "invited_email" character varying(100), "invited_phone" character varying(15), "invitation_token" character varying(100),
        "invited_at" TIMESTAMP, "joined_at" TIMESTAMP, "approved_at" TIMESTAMP, "approved_by" uuid,
        CONSTRAINT "PK_f1ef7a4fd2eabf7ef3c6bc7cae3" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_e953f3fbacca0785e19f26d5acb" UNIQUE ("invitation_token"),
        CONSTRAINT "UQ_ebae351dd2d5e456290bba051a9" UNIQUE ("class_id", "student_id"),
        CONSTRAINT "UQ_f3fbeaf5af80a1feb28b5dfbf60" UNIQUE ("class_id", "invitation_token"),
        CONSTRAINT "FK_43e081daadb906f3dc41bb267dd" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_6d12f65ab61f9f92e3d7e95ad23" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE)
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_43e081daadb906f3dc41bb267d" ON "class_students" ("class_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_6d12f65ab61f9f92e3d7e95ad2" ON "class_students" ("student_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_e953f3fbacca0785e19f26d5ac" ON "class_students" ("invitation_token")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_teachers" (${BASE},
        "is_active" "public"."class_teachers_is_active_enum" NOT NULL DEFAULT '1',
        "class_id" uuid NOT NULL, "teacher_id" uuid NOT NULL, "subject_id" uuid,
        CONSTRAINT "PK_af6f6d3e46a2ac73959f65f3d9a" PRIMARY KEY ("id"),
        CONSTRAINT "FK_1192d6f4432d1de68d66e9a9cd7" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_504b6c1a3616565a5a1cedcaa63" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_6d766c46bea28417ed5d6eaec1c" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL)
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1192d6f4432d1de68d66e9a9cd" ON "class_teachers" ("class_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_504b6c1a3616565a5a1cedcaa6" ON "class_teachers" ("teacher_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_6d766c46bea28417ed5d6eaec1" ON "class_teachers" ("subject_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_class_teachers_class_teacher_subject" ON "class_teachers" ("class_id", "teacher_id", "subject_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_subject_teachers" (${BASE},
        "is_active" "public"."class_subject_teachers_is_active_enum" NOT NULL DEFAULT '1',
        "class_subject_id" uuid NOT NULL, "teacher_id" uuid NOT NULL,
        CONSTRAINT "PK_f34c4ef8d03aaf67a036ebb9d6b" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_7a6f4f6223b45384fd153c02639" UNIQUE ("class_subject_id", "teacher_id"),
        CONSTRAINT "FK_72006e95f637fd0ed749915cf73" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_b5a0a77a4828e16196e7c51ffb9" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE)
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_72006e95f637fd0ed749915cf7" ON "class_subject_teachers" ("class_subject_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b5a0a77a4828e16196e7c51ffb" ON "class_subject_teachers" ("teacher_id")`);

    // Refill: current students (one row per class and student, same id), and subject teachers.
    const appTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    await queryRunner.query(
      `
      INSERT INTO class_students (id, class_id, student_id, status, invited_email, invited_phone, invitation_token, joined_at, created_by, created_at, is_active)
      SELECT DISTINCT ON (e.class_id, COALESCE(e.student_id::text, e.id::text))
        e.id, e.class_id, e.student_id,
        (CASE e.status::text WHEN 'ACTIVE' THEN 'JOINED' ELSE e.status::text END)::class_students_status_enum,
        e.invited_email, e.invited_phone, e.invitation_token, e.joined_at AT TIME ZONE $1, e.created_by, e.created_at, '1'
      FROM enrolments e
      JOIN academic_sessions ses ON ses.id = e.session_id AND ses.status = 'ACTIVE'
      WHERE e.status IN ('INVITED', 'PENDING', 'ACTIVE')
      ORDER BY e.class_id, COALESCE(e.student_id::text, e.id::text), e.created_at DESC
      ON CONFLICT DO NOTHING
      `,
      [appTimeZone],
    );
    await queryRunner.query(`
      INSERT INTO class_subject_teachers (class_subject_id, teacher_id, created_at, is_active)
      SELECT DISTINCT cs.id, ot.teacher_id, now(), '1'::class_subject_teachers_is_active_enum
      FROM offering_teachers ot
      JOIN course_offerings o ON o.id = ot.offering_id
      JOIN sections s ON s.id = o.section_id
      JOIN academic_sessions ses ON ses.id = s.session_id AND ses.status = 'ACTIVE'
      JOIN class_subjects cs ON cs.class_id = s.class_id AND cs.subject_id = o.subject_id
      ON CONFLICT DO NOTHING
    `);
  }
}
