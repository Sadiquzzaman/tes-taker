import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Each user's language (FND-18, design §8.9): 'bn' or 'en'. NULL means not chosen yet,
 * so the organisation default (P2-04) and then English apply.
 */
export class AddLocaleToUsers1755100000000 implements MigrationInterface {
  name = 'AddLocaleToUsers1755100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "locale" varchar(5) NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "users" ADD CONSTRAINT "CHK_users_locale" CHECK ("locale" IN ('bn', 'en'));
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_users_locale"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "locale"`);
  }
}
