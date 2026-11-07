import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One-day changes to a class (P5-04 part 3, CAL-01: "exceptions for one date … don't change the
 * rest of the routine"; design §9.4). A class session can be saved ahead with other times (its
 * `starts_at`/`ends_at`) and now a substitute teacher, with who changed it, when and a note.
 *
 * Nullable columns on `class_attendance`; no existing row changes. Safe to run twice; logs a count check.
 */
export class ClassSessionChanges1756300000000 implements MigrationInterface {
  name = 'ClassSessionChanges1756300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "class_attendance" ADD COLUMN IF NOT EXISTS "substitute_teacher_id" uuid`);
    await queryRunner.query(`ALTER TABLE "class_attendance" ADD COLUMN IF NOT EXISTS "changed_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "class_attendance" ADD COLUMN IF NOT EXISTS "changed_by" uuid`);
    await queryRunner.query(`ALTER TABLE "class_attendance" ADD COLUMN IF NOT EXISTS "change_note" character varying(300)`);
    await this.addConstraint(queryRunner, 'FK_class_attendance_substitute',
      `FOREIGN KEY ("substitute_teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'FK_class_attendance_changed_by',
      `FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_class_attendance_substitute" ON "class_attendance" ("substitute_teacher_id", "date") WHERE "substitute_teacher_id" IS NOT NULL`);

    const [counts] = await queryRunner.query(`
      SELECT count(*)::int AS sessions, count(*) FILTER (WHERE substitute_teacher_id IS NOT NULL OR changed_at IS NOT NULL)::int AS changed
      FROM class_attendance
    `);
    console.log(`[ClassSessionChanges] class sessions: ${counts.sessions}, changed for a day: ${counts.changed}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_class_attendance_substitute"`);
    await queryRunner.query(`ALTER TABLE "class_attendance" DROP CONSTRAINT IF EXISTS "FK_class_attendance_changed_by"`);
    await queryRunner.query(`ALTER TABLE "class_attendance" DROP CONSTRAINT IF EXISTS "FK_class_attendance_substitute"`);
    await queryRunner.query(`ALTER TABLE "class_attendance" DROP COLUMN IF EXISTS "change_note"`);
    await queryRunner.query(`ALTER TABLE "class_attendance" DROP COLUMN IF EXISTS "changed_by"`);
    await queryRunner.query(`ALTER TABLE "class_attendance" DROP COLUMN IF EXISTS "changed_at"`);
    await queryRunner.query(`ALTER TABLE "class_attendance" DROP COLUMN IF EXISTS "substitute_teacher_id"`);
  }

  private async addConstraint(queryRunner: QueryRunner, name: string, definition: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "class_attendance" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$;
    `);
  }
}
