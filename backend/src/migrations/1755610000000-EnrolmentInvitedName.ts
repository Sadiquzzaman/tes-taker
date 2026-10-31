import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The name given for an invited student (P2-05, FND-04 CSV import): enrolments.invited_name.
 *
 * Expand only: a nullable varchar(150). Invitations made before this keep NULL (screens show the
 * phone or email, as before). No data is changed. Safe to run twice; logs a count check.
 */
export class EnrolmentInvitedName1755610000000 implements MigrationInterface {
  name = 'EnrolmentInvitedName1755610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "enrolments" ADD COLUMN IF NOT EXISTS "invited_name" character varying(150)`);
    const [counts] = await queryRunner.query(`
      SELECT
        (SELECT count(*)::int FROM enrolments WHERE status = 'INVITED') AS invitations,
        (SELECT count(*)::int FROM enrolments WHERE invited_name IS NOT NULL) AS with_name
    `);
    console.log(`[EnrolmentInvitedName] invitations: ${counts.invitations}, with a name: ${counts.with_name}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "enrolments" DROP COLUMN IF EXISTS "invited_name"`);
  }
}
