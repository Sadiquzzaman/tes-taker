import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Solo IELTS trainers (P12-03, IEL-11): the workspace type a teacher chose at sign-up, kept on their
 * teacher request until it is approved (their solo workspace is then made with it).
 *
 * A new column with a default; every existing request is ACADEMIC. Safe to run twice; logs a count check.
 */
export class SoloIelts1756530000000 implements MigrationInterface {
  name = 'SoloIelts1756530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teacher_role_requests" ADD COLUMN IF NOT EXISTS "workspace_type" character varying(10) NOT NULL DEFAULT 'ACADEMIC'`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_teacher_role_requests_workspace_type') THEN
          ALTER TABLE "teacher_role_requests" ADD CONSTRAINT "CHK_teacher_role_requests_workspace_type" CHECK ("workspace_type" IN ('ACADEMIC', 'IELTS'));
        END IF;
      END $$;
    `);
    const [counts] = await queryRunner.query(`SELECT (SELECT count(*) FROM teacher_role_requests WHERE workspace_type = 'IELTS')::int AS ielts`);
    console.log(`[SoloIelts] IELTS teacher requests: ${counts.ielts}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teacher_role_requests" DROP CONSTRAINT IF EXISTS "CHK_teacher_role_requests_workspace_type"`);
    await queryRunner.query(`ALTER TABLE "teacher_role_requests" DROP COLUMN IF EXISTS "workspace_type"`);
  }
}
