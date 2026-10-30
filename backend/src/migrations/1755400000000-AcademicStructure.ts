import { MigrationInterface, QueryRunner } from 'typeorm';

const BASE_COLUMNS = `
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "created_by" uuid, "created_user_name" character varying(100),
  "updated_by" uuid, "updated_user_name" character varying(100),
  "created_at" TIMESTAMP, "updated_at" TIMESTAMP`;

/** The new tables, in creation order (down drops them in reverse). */
const TABLES = ['org_settings', 'academic_sessions', 'terms', 'sections', 'course_offerings', 'offering_teachers', 'offering_enrolments', 'enrolments'];

/** The default session of each organisation. */
const DEFAULT_SESSIONS = `SELECT id, organization_id FROM academic_sessions WHERE is_default = true`;

/**
 * Every legacy teacher link of a class subject, as (class_id, subject_id, teacher_id): subject
 * teachers (class_subject_teachers), class teachers with a subject, and class teachers without a
 * subject, who teach every subject of the class. Duplicates are removed by the caller.
 */
const LEGACY_TEACHER_LINKS = `
  SELECT cs.class_id, cs.subject_id, cst.teacher_id
  FROM class_subject_teachers cst JOIN class_subjects cs ON cs.id = cst.class_subject_id
  UNION
  SELECT ct.class_id, ct.subject_id, ct.teacher_id FROM class_teachers ct WHERE ct.subject_id IS NOT NULL
  UNION
  SELECT ct.class_id, cs.subject_id, ct.teacher_id
  FROM class_teachers ct JOIN class_subjects cs ON cs.class_id = ct.class_id
  WHERE ct.subject_id IS NULL
`;

/**
 * Academic structure (P2-03: FND-01, FND-02, FND-04, FND-19; design §9.3 and migration step M3).
 *
 * Expand: academic sessions, terms, sections, subject classes (course_offerings) with their
 * teachers and selected students, enrolments, org_settings (class_teacher_enabled), exams.session_id.
 * Migrate: a default session (the current year in the organisation's time zone) per organisation,
 * section "A" per class, class_students -> enrolments (same row id, status kept), one subject class
 * per section + class subject, and its teachers from class_subject_teachers and class_teachers
 * (deduplicated; organization_teacher_subjects is a list of what a teacher can teach, not an
 * assignment, so it is not copied). The earliest class teacher without a subject becomes the
 * section's class teacher where the organisation uses class teachers. Exams get the default session.
 *
 * The legacy tables stay and are mirrored (LegacyClassSync) until the reads move (P2-03 part 2).
 * Safe to run twice; logs a count check.
 */
export class AcademicStructure1755400000000 implements MigrationInterface {
  name = 'AcademicStructure1755400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.expand(queryRunner);
    const before = await this.legacyCounts(queryRunner);

    // 1. Settings: class teachers are on for schools and coaching centres, off for solo teachers.
    await queryRunner.query(`
      INSERT INTO org_settings (organization_id, class_teacher_enabled, created_user_name, created_at, is_active)
      SELECT o.id, o.kind <> 'SOLO', 'Migration P2-03', now(), '1'
      FROM organizations o
      WHERE NOT EXISTS (SELECT 1 FROM org_settings s WHERE s.organization_id = o.id)
    `);

    // 2. A default session per organisation: this calendar year in its time zone.
    await queryRunner.query(`
      INSERT INTO academic_sessions (organization_id, name, start_date, end_date, status, is_default, created_user_name, created_at, is_active)
      SELECT o.id, yr.y::text, make_date(yr.y, 1, 1), make_date(yr.y, 12, 31), 'ACTIVE', true, 'Migration P2-03', now(), '1'
      FROM organizations o
      CROSS JOIN LATERAL (SELECT EXTRACT(YEAR FROM now() AT TIME ZONE o.timezone)::int AS y) yr
      WHERE NOT EXISTS (SELECT 1 FROM academic_sessions s WHERE s.organization_id = o.id AND s.is_default = true)
    `);

    // 3. Section "A" for every class without a section in its organisation's default session.
    await queryRunner.query(`
      INSERT INTO sections (organization_id, class_id, session_id, name, created_user_name, created_at, is_active)
      SELECT c.organization_id, c.id, ds.id, 'A', 'Migration P2-03', now(), '1'
      FROM classes c
      JOIN (${DEFAULT_SESSIONS}) ds ON ds.organization_id = c.organization_id
      WHERE NOT EXISTS (SELECT 1 FROM sections s WHERE s.class_id = c.id AND s.session_id = ds.id)
    `);

    // 4. class_students -> enrolments in the class's first section of the default session.
    //    class_students.joined_at is a timestamp without time zone, written by node-postgres as the
    //    API process's local time; this migration runs in the same image, so convert from its zone.
    const appTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    await queryRunner.query(`
      INSERT INTO enrolments (
        id, organization_id, session_id, class_id, section_id, student_id, status,
        invited_phone, invited_email, invitation_token, joined_at,
        created_by, created_user_name, updated_by, updated_user_name, created_at, updated_at, is_active
      )
      SELECT cs.id, c.organization_id, sec.session_id, c.id, sec.id, cs.student_id,
        (CASE cs.status::text WHEN 'JOINED' THEN 'ACTIVE' ELSE cs.status::text END)::enrolments_status_enum,
        cs.invited_phone, cs.invited_email, cs.invitation_token, cs.joined_at AT TIME ZONE $1,
        cs.created_by, cs.created_user_name, cs.updated_by, cs.updated_user_name, cs.created_at, cs.updated_at,
        cs.is_active::text::enrolments_is_active_enum
      FROM class_students cs
      JOIN classes c ON c.id = cs.class_id
      JOIN (${DEFAULT_SESSIONS}) ds ON ds.organization_id = c.organization_id
      CROSS JOIN LATERAL (
        SELECT s.id, s.session_id FROM sections s
        WHERE s.class_id = c.id AND s.session_id = ds.id
        ORDER BY s.created_at NULLS LAST, s.name LIMIT 1
      ) sec
      WHERE NOT EXISTS (SELECT 1 FROM enrolments e WHERE e.id = cs.id)
      ON CONFLICT DO NOTHING
    `, [appTimeZone]);

    // 5. One subject class per section (default session) and class subject.
    await queryRunner.query(`
      INSERT INTO course_offerings (organization_id, session_id, section_id, subject_id, created_user_name, created_at, is_active)
      SELECT s.organization_id, s.session_id, s.id, cs.subject_id, 'Migration P2-03', now(), '1'
      FROM sections s
      JOIN (${DEFAULT_SESSIONS}) ds ON ds.id = s.session_id
      JOIN class_subjects cs ON cs.class_id = s.class_id
      WHERE NOT EXISTS (
        SELECT 1 FROM course_offerings o WHERE o.section_id = s.id AND o.subject_id = cs.subject_id AND o.term_id IS NULL
      )
    `);

    // 6. Its teachers, deduplicated.
    await queryRunner.query(`
      INSERT INTO offering_teachers (organization_id, offering_id, teacher_id, created_user_name, created_at, is_active)
      SELECT DISTINCT o.organization_id, o.id, link.teacher_id, 'Migration P2-03', now(), '1'::offering_teachers_is_active_enum
      FROM (${LEGACY_TEACHER_LINKS}) link
      JOIN sections s ON s.class_id = link.class_id
      JOIN (${DEFAULT_SESSIONS}) ds ON ds.id = s.session_id
      JOIN course_offerings o ON o.section_id = s.id AND o.subject_id = link.subject_id AND o.term_id IS NULL
      ON CONFLICT DO NOTHING
    `);

    // 7. Where the organisation uses class teachers: the earliest class teacher without a subject.
    await queryRunner.query(`
      UPDATE sections s SET class_teacher_id = (
        SELECT ct.teacher_id FROM class_teachers ct
        WHERE ct.class_id = s.class_id AND ct.subject_id IS NULL
        ORDER BY ct.created_at NULLS LAST, ct.id LIMIT 1
      )
      WHERE s.class_teacher_id IS NULL
        AND s.session_id IN (SELECT id FROM (${DEFAULT_SESSIONS}) ds)
        AND EXISTS (SELECT 1 FROM org_settings os WHERE os.organization_id = s.organization_id AND os.class_teacher_enabled = true)
        AND EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id = s.class_id AND ct.subject_id IS NULL)
    `);

    // 8. Exams belong to their organisation's default session.
    await queryRunner.query(`
      UPDATE exams e SET session_id = ds.id
      FROM (${DEFAULT_SESSIONS}) ds
      WHERE e.session_id IS NULL AND ds.organization_id = e.organization_id
    `);

    // Count check (design §12): legacy rows = new rows, logged.
    const after = await this.newCounts(queryRunner);
    console.log('[AcademicStructure] legacy:', before, '-> new:', after);
  }

  /**
   * Back to the legacy tables only. Sessions, sections and subject classes created after the
   * migration are lost; class_students and the teacher tables were never changed.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "FK_02383ddef36804aa9a9d7ea4d51"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN IF EXISTS "session_id"`);
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
    for (const type of [
      'enrolments_status_enum',
      'enrolments_is_active_enum',
      'offering_enrolments_is_active_enum',
      'offering_teachers_is_active_enum',
      'course_offerings_enrolment_mode_enum',
      'course_offerings_is_active_enum',
      'sections_shift_enum',
      'sections_is_active_enum',
      'terms_is_active_enum',
      'academic_sessions_status_enum',
      'academic_sessions_is_active_enum',
      'org_settings_is_active_enum',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "public"."${type}"`);
    }
  }

  private async expand(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await this.createEnum(queryRunner, `${table}_is_active_enum`, `'1', '0'`);
    }
    await this.createEnum(queryRunner, 'academic_sessions_status_enum', `'ACTIVE', 'CLOSED'`);
    await this.createEnum(queryRunner, 'sections_shift_enum', `'MORNING', 'DAY', 'EVENING'`);
    await this.createEnum(queryRunner, 'course_offerings_enrolment_mode_enum', `'WHOLE_SECTION', 'SELECTED'`);
    await this.createEnum(queryRunner, 'enrolments_status_enum', `'INVITED', 'PENDING', 'ACTIVE', 'LEFT', 'PROMOTED'`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_settings" (${BASE_COLUMNS},
        "is_active" "public"."org_settings_is_active_enum" NOT NULL DEFAULT '1',
        "organization_id" uuid NOT NULL, "class_teacher_enabled" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_3726dc3a3dfdcd4f0d95b330789" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_7f073bff4401e6cc4cfe6c8411" ON "org_settings" ("organization_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "academic_sessions" (${BASE_COLUMNS},
        "is_active" "public"."academic_sessions_is_active_enum" NOT NULL DEFAULT '1',
        "organization_id" uuid NOT NULL, "name" character varying(80) NOT NULL,
        "start_date" date NOT NULL, "end_date" date NOT NULL,
        "status" "public"."academic_sessions_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "is_default" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_8dba9ed9bef819af7a31769c04b" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_academic_sessions_default" ON "academic_sessions" ("organization_id") WHERE "is_default" = true`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_7332bb14a91150ab675de2824b" ON "academic_sessions" ("organization_id", "status")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "terms" (${BASE_COLUMNS},
        "is_active" "public"."terms_is_active_enum" NOT NULL DEFAULT '1',
        "organization_id" uuid NOT NULL, "session_id" uuid NOT NULL, "name" character varying(80) NOT NULL,
        "start_date" date, "end_date" date, "sort_order" smallint NOT NULL DEFAULT '0',
        CONSTRAINT "PK_33b6fe77d6ace7ff43cc8a65958" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3a706a1501847a494bccd5a5b0" ON "terms" ("organization_id", "session_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sections" (${BASE_COLUMNS},
        "is_active" "public"."sections_is_active_enum" NOT NULL DEFAULT '1',
        "organization_id" uuid NOT NULL, "class_id" uuid NOT NULL, "session_id" uuid NOT NULL,
        "name" character varying(60) NOT NULL, "shift" "public"."sections_shift_enum",
        "room" character varying(40), "class_teacher_id" uuid,
        CONSTRAINT "PK_f9749dd3bffd880a497d007e450" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_9e40f861d3aaf51ea6e9ba4b76" ON "sections" ("class_teacher_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fce0fc6fc560a4c6ef06556df7" ON "sections" ("organization_id", "session_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_8a586f7ca4dd290146e7c87c2c" ON "sections" ("class_id", "session_id", "name")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_offerings" (${BASE_COLUMNS},
        "is_active" "public"."course_offerings_is_active_enum" NOT NULL DEFAULT '1',
        "organization_id" uuid NOT NULL, "session_id" uuid NOT NULL, "term_id" uuid,
        "section_id" uuid NOT NULL, "subject_id" uuid NOT NULL,
        "enrolment_mode" "public"."course_offerings_enrolment_mode_enum" NOT NULL DEFAULT 'WHOLE_SECTION',
        "is_optional" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_f174de9e3b3a04f05870a8684c8" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3369825b64c243fc7d0d5f3f18" ON "course_offerings" ("organization_id", "session_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_course_offerings_section_subject_term" ON "course_offerings" ("section_id", "subject_id", "term_id") WHERE "term_id" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_course_offerings_section_subject" ON "course_offerings" ("section_id", "subject_id") WHERE "term_id" IS NULL`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "offering_teachers" (${BASE_COLUMNS},
        "is_active" "public"."offering_teachers_is_active_enum" NOT NULL DEFAULT '1',
        "organization_id" uuid NOT NULL, "offering_id" uuid NOT NULL, "teacher_id" uuid NOT NULL,
        CONSTRAINT "PK_f8ef309381ca77485d99e1d463f" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fa7f1296d4d024907cbb48f3ba" ON "offering_teachers" ("teacher_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_da1127b12bff20c5996686d3d0" ON "offering_teachers" ("offering_id", "teacher_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "offering_enrolments" (${BASE_COLUMNS},
        "is_active" "public"."offering_enrolments_is_active_enum" NOT NULL DEFAULT '1',
        "organization_id" uuid NOT NULL, "offering_id" uuid NOT NULL, "student_id" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_99b04d54ef0d9f39b53adc4af2e" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_58e3a165e05178b58928acd04e" ON "offering_enrolments" ("student_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_5c7d9dc78d13a9db076e2243af" ON "offering_enrolments" ("offering_id", "student_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enrolments" (${BASE_COLUMNS},
        "is_active" "public"."enrolments_is_active_enum" NOT NULL DEFAULT '1',
        "organization_id" uuid NOT NULL, "session_id" uuid NOT NULL, "class_id" uuid NOT NULL,
        "section_id" uuid NOT NULL, "student_id" uuid, "roll_no" character varying(20),
        "status" "public"."enrolments_status_enum" NOT NULL,
        "invited_phone" character varying(15), "invited_email" character varying(100),
        "invitation_token" character varying(100),
        "joined_at" TIMESTAMP WITH TIME ZONE, "left_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_6e79971fbd26967c4da9ed52770" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ad90b3ff394d6ce12b97a02c2a" ON "enrolments" ("organization_id", "student_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dc7100d411039d3c8810750a1a" ON "enrolments" ("section_id", "status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_47bdddddc7dd31150b40364f81" ON "enrolments" ("session_id", "class_id", "student_id")`);

    await queryRunner.query(`ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "session_id" uuid`);

    const foreignKeys: Array<[string, string, string]> = [
      ['org_settings', 'FK_7f073bff4401e6cc4cfe6c84114', `("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`],
      ['academic_sessions', 'FK_7ea2dd6c139696aff2f493a7f39', `("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE`],
      ['exams', 'FK_02383ddef36804aa9a9d7ea4d51', `("session_id") REFERENCES "academic_sessions"("id") ON DELETE SET NULL`],
      ['terms', 'FK_2a45e5f1a157f965dad749ef1dd', `("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE`],
      ['sections', 'FK_27db91d7369af6f181412afa99f', `("class_id") REFERENCES "classes"("id") ON DELETE CASCADE`],
      ['sections', 'FK_ddbf412e678e1b3a44e3653885b', `("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE`],
      ['sections', 'FK_9e40f861d3aaf51ea6e9ba4b76d', `("class_teacher_id") REFERENCES "users"("id") ON DELETE SET NULL`],
      ['course_offerings', 'FK_47e71144c159c49865f6e72e0fc', `("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE`],
      ['course_offerings', 'FK_aaa13b03f561195516ed1de48ff', `("term_id") REFERENCES "terms"("id") ON DELETE SET NULL`],
      ['course_offerings', 'FK_58179afecb517ecd1a5bc8b3284', `("section_id") REFERENCES "sections"("id") ON DELETE CASCADE`],
      ['course_offerings', 'FK_26c5042522c45c254b9d324a5d7', `("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE`],
      ['offering_teachers', 'FK_205395e150ff8ee5e882aea16a1', `("offering_id") REFERENCES "course_offerings"("id") ON DELETE CASCADE`],
      ['offering_teachers', 'FK_fa7f1296d4d024907cbb48f3ba1', `("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE`],
      ['offering_enrolments', 'FK_c71887df5ff7fefb982cb225b5f', `("offering_id") REFERENCES "course_offerings"("id") ON DELETE CASCADE`],
      ['offering_enrolments', 'FK_58e3a165e05178b58928acd04ee', `("student_id") REFERENCES "users"("id") ON DELETE CASCADE`],
      ['enrolments', 'FK_47e6f1c9dc1519e4335fad6ba5b', `("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE`],
      ['enrolments', 'FK_0eecdbc0cae81931814c85ec284', `("class_id") REFERENCES "classes"("id") ON DELETE CASCADE`],
      ['enrolments', 'FK_23ddc1be38d31e48bb4dc97ba65', `("section_id") REFERENCES "sections"("id") ON DELETE CASCADE`],
      ['enrolments', 'FK_249771254e7dc03134d5dfc5618', `("student_id") REFERENCES "users"("id") ON DELETE CASCADE`],
    ];
    for (const [table, name, definition] of foreignKeys) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ${definition} ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    }
  }

  private async createEnum(queryRunner: QueryRunner, name: string, values: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."${name}" AS ENUM(${values});
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
  }

  private async legacyCounts(queryRunner: QueryRunner): Promise<Record<string, number>> {
    const [row] = await queryRunner.query(`
      SELECT
        (SELECT COUNT(*) FROM organizations)::int AS organizations,
        (SELECT COUNT(*) FROM classes WHERE organization_id IS NOT NULL)::int AS classes,
        (SELECT COUNT(*) FROM class_students cs JOIN classes c ON c.id = cs.class_id WHERE c.organization_id IS NOT NULL)::int AS class_students,
        (SELECT COUNT(*) FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE c.organization_id IS NOT NULL)::int AS class_subjects,
        (SELECT COUNT(*) FROM (${LEGACY_TEACHER_LINKS}) l JOIN classes c ON c.id = l.class_id WHERE c.organization_id IS NOT NULL)::int AS teacher_links,
        (SELECT COUNT(*) FROM exams WHERE organization_id IS NOT NULL)::int AS exams
    `);
    return row;
  }

  /** The same counts from the new tables, for the default session (what this migration fills). */
  private async newCounts(queryRunner: QueryRunner): Promise<Record<string, number>> {
    const [row] = await queryRunner.query(`
      SELECT
        (SELECT COUNT(*) FROM (${DEFAULT_SESSIONS}) ds)::int AS organizations,
        (SELECT COUNT(DISTINCT s.class_id) FROM sections s JOIN (${DEFAULT_SESSIONS}) ds ON ds.id = s.session_id)::int AS classes,
        (SELECT COUNT(*) FROM enrolments e JOIN class_students cs ON cs.id = e.id)::int AS class_students,
        (SELECT COUNT(*) FROM course_offerings o JOIN (${DEFAULT_SESSIONS}) ds ON ds.id = o.session_id)::int AS class_subjects,
        (SELECT COUNT(*) FROM offering_teachers t JOIN course_offerings o ON o.id = t.offering_id JOIN (${DEFAULT_SESSIONS}) ds ON ds.id = o.session_id)::int AS teacher_links,
        (SELECT COUNT(*) FROM exams WHERE organization_id IS NOT NULL AND session_id IS NOT NULL)::int AS exams
    `);
    return row;
  }
}
