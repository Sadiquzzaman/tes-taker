import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Account deletion (mobile-api #358, both app stores require it): a deleted account keeps its row, so
 * the school's history stays, but is deactivated and anonymised. These columns record when, by whom
 * and why.
 *
 * New nullable columns; no row changes. Safe to run twice; logs a count check.
 */
export class AccountDeletion1756560000000 implements MigrationInterface {
  name = 'AccountDeletion1756560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_by" uuid`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_reason" character varying(500)`);
    const [counts] = await queryRunner.query(`SELECT count(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted FROM users`);
    console.log(`[AccountDeletion] deleted accounts: ${counts.deleted}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deletion_reason"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_by"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_at"`);
  }
}
