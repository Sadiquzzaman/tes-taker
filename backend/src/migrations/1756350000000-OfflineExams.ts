import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paper exams and their marks (P7-01, PRF-03; design §9.8). Owned by the exams module.
 *
 * - `offline_exams`: an exam taken on paper for one subject class (section + subject + session),
 *   with its date, total marks, optional parts (e.g. MCQ 30 + Written 70), an optional term, when
 *   its marks were published to students, and soft removal (removed_at/by; never deleted).
 * - `offline_exam_marks`: one row per exam and student: marks (or per-part marks summed), or absent.
 *
 * New empty tables only; no existing row changes. Safe to run twice; logs a count check.
 */
export class OfflineExams1756350000000 implements MigrationInterface {
  name = 'OfflineExams1756350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "offline_exams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "term_id" uuid,
        "offering_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "exam_date" date NOT NULL,
        "total_marks" numeric(6,2) NOT NULL,
        "parts" jsonb,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by" uuid,
        "updated_at" TIMESTAMP WITH TIME ZONE,
        "removed_at" TIMESTAMP WITH TIME ZONE,
        "removed_by" uuid,
        CONSTRAINT "PK_offline_exams" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_offline_exams_total" CHECK ("total_marks" > 0)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_offline_exams_org_offering" ON "offline_exams" ("organization_id", "offering_id", "exam_date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_offline_exams_org_session" ON "offline_exams" ("organization_id", "session_id")`);
    await this.addConstraint(queryRunner, 'offline_exams', 'FK_offline_exams_session',
      `FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'offline_exams', 'FK_offline_exams_term',
      `FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'offline_exams', 'FK_offline_exams_offering',
      `FOREIGN KEY ("offering_id") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "offline_exam_marks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "offline_exam_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "marks" numeric(6,2),
        "part_marks" jsonb,
        "is_absent" boolean NOT NULL DEFAULT false,
        "entered_by" uuid,
        "entered_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_offline_exam_marks" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_offline_exam_marks_marks" CHECK ("marks" IS NULL OR "marks" >= 0)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_offline_exam_marks_student" ON "offline_exam_marks" ("offline_exam_id", "student_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_offline_exam_marks_org_student" ON "offline_exam_marks" ("organization_id", "student_id")`);
    await this.addConstraint(queryRunner, 'offline_exam_marks', 'FK_offline_exam_marks_exam',
      `FOREIGN KEY ("offline_exam_id") REFERENCES "offline_exams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'offline_exam_marks', 'FK_offline_exam_marks_student',
      `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT (SELECT count(*)::int FROM offline_exams) AS exams, (SELECT count(*)::int FROM offline_exam_marks) AS marks
    `);
    console.log(`[OfflineExams] exams: ${counts.exams}, marks: ${counts.marks}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "offline_exam_marks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "offline_exams"`);
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
