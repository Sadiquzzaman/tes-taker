import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tests per subject class (P2-03, FND-19; design §9.6): exams.offering_id (only that subject class's
 * students take the test) and exams.term_id (reserved for PRF-02). Expand only: existing exams keep
 * NULL and stay whole-class tests. Safe to run twice; reversible.
 */
export class ExamSubjectClasses1755410000000 implements MigrationInterface {
  name = 'ExamSubjectClasses1755410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "offering_id" uuid, ADD COLUMN IF NOT EXISTS "term_id" uuid`);
    for (const [name, definition] of [
      ['FK_bfcb328b88c334fcf523a785744', `("offering_id") REFERENCES "course_offerings"("id") ON DELETE SET NULL`],
      ['FK_a09e73ec2b5b6628ae05af5bedb', `("term_id") REFERENCES "terms"("id") ON DELETE SET NULL`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "exams" ADD CONSTRAINT "${name}" FOREIGN KEY ${definition} ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    }
    const [{ exams }] = await queryRunner.query(`SELECT COUNT(*)::int AS exams FROM exams`);
    console.log(`[ExamSubjectClasses] exams: ${exams}, all whole-class (offering_id NULL)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "FK_a09e73ec2b5b6628ae05af5bedb"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "FK_bfcb328b88c334fcf523a785744"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN IF EXISTS "term_id", DROP COLUMN IF EXISTS "offering_id"`);
  }
}
