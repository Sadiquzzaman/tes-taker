import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IELTS courses (P12-04, IEL-13): a course is the ielts module's row over a class, a session and one
 * section (the academic engine underneath).
 *
 * - `ielts_courses`: title, branch, dates, modules, status; its class, session and section.
 * - `sections.seat_limit`: enrolment refused once reached (academics; any section may use it).
 * - `org_settings.ended_course_visible_days`: how long students still see an ended course.
 * - Existing IELTS batches (sections of IELTS workspaces in open sessions) become courses: one per
 *   section, titled by the class (and the section when the class has several), dated by the
 *   session, with all four modules. Only test accounts used IELTS before this (16 Nov 2026).
 *
 * Safe to run twice; logs a count check. `down` drops the table and the two columns.
 */
export class IeltsCourses1756550000000 implements MigrationInterface {
  name = 'IeltsCourses1756550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "seat_limit" smallint`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_sections_seat_limit') THEN
          ALTER TABLE "sections" ADD CONSTRAINT "CHK_sections_seat_limit" CHECK ("seat_limit" IS NULL OR "seat_limit" > 0);
        END IF;
      END $$;
    `);
    await queryRunner.query(`ALTER TABLE "org_settings" ADD COLUMN IF NOT EXISTS "ended_course_visible_days" smallint NOT NULL DEFAULT 0`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ielts_courses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "branch_id" uuid,
        "class_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "section_id" uuid NOT NULL,
        "modules" character varying(10)[] NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        CONSTRAINT "PK_ielts_courses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ielts_courses_section" UNIQUE ("section_id"),
        CONSTRAINT "CHK_ielts_courses_dates" CHECK ("end_date" >= "start_date"),
        CONSTRAINT "CHK_ielts_courses_modules" CHECK (cardinality("modules") BETWEEN 1 AND 4 AND "modules" <@ ARRAY['LISTENING','READING','WRITING','SPEAKING']::varchar[])
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ielts_courses_org_branch" ON "ielts_courses" ("organization_id", "branch_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ielts_courses_org_dates" ON "ielts_courses" ("organization_id", "start_date")`);
    for (const [name, definition] of [
      ['FK_ielts_courses_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['FK_ielts_courses_branch', `FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`],
      ['FK_ielts_courses_class', `FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['FK_ielts_courses_session', `FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['FK_ielts_courses_section', `FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE "ielts_courses" ADD CONSTRAINT "${name}" ${definition};
          END IF;
        END $$;
      `);
    }
    // Existing IELTS batches become courses (test accounts only).
    await queryRunner.query(`
      INSERT INTO ielts_courses (organization_id, title, branch_id, class_id, session_id, section_id, modules, start_date, end_date, created_at)
      SELECT s.organization_id,
             left(CASE WHEN (SELECT count(*) FROM sections s2 WHERE s2.class_id = s.class_id AND s2.session_id = s.session_id) > 1
                       THEN c.class_name || ' ' || s.name ELSE c.class_name END, 150),
             COALESCE(s.branch_id, (SELECT b.id FROM branches b WHERE b.organization_id = s.organization_id AND b.is_default LIMIT 1)),
             s.class_id, s.session_id, s.id,
             ARRAY['LISTENING','READING','WRITING','SPEAKING']::varchar[],
             ses.start_date, ses.end_date, now()
      FROM sections s
      JOIN classes c ON c.id = s.class_id
      JOIN academic_sessions ses ON ses.id = s.session_id AND ses.status = 'ACTIVE'
      JOIN organizations o ON o.id = s.organization_id AND o.workspace_type = 'IELTS'
      WHERE NOT EXISTS (SELECT 1 FROM ielts_courses ic WHERE ic.section_id = s.id)
    `);
    const [counts] = await queryRunner.query(`SELECT (SELECT count(*) FROM ielts_courses)::int AS courses`);
    console.log(`[IeltsCourses] courses: ${counts.courses}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ielts_courses"`);
    await queryRunner.query(`ALTER TABLE "org_settings" DROP COLUMN IF EXISTS "ended_course_visible_days"`);
    await queryRunner.query(`ALTER TABLE "sections" DROP CONSTRAINT IF EXISTS "CHK_sections_seat_limit"`);
    await queryRunner.query(`ALTER TABLE "sections" DROP COLUMN IF EXISTS "seat_limit"`);
  }
}
