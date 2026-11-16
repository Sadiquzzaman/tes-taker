import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Signed-in devices (PM-01, design §8.2), owned by the user module, which issues the tokens.
 *
 * - `refresh_tokens`: one row per signed-in device with the SHA-256 of its rotating refresh token,
 *   the token it replaced (accepted for a short grace), platform, device name, last use, expiry and
 *   when and why it was signed out. Rows are never deleted.
 *
 * A new empty table; `users.refresh_token` is left as it is (the code moves a token still there
 * into this table on its next refresh). Safe to run twice; logs a count check.
 */
export class RefreshTokens1756510000000 implements MigrationInterface {
  name = 'RefreshTokens1756510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "previous_hash" character varying(64),
        "rotated_at" TIMESTAMP WITH TIME ZONE,
        "platform" character varying(10) NOT NULL DEFAULT 'WEB',
        "device_name" character varying(120),
        "app_version" character varying(30),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "revoked_reason" character varying(30),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_refresh_tokens_platform" CHECK ("platform" IN ('WEB', 'ANDROID', 'IOS'))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_previous_hash" ON "refresh_tokens" ("previous_hash")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user" ON "refresh_tokens" ("user_id", "revoked_at")`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_refresh_tokens_user') THEN
          ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    const [counts] = await queryRunner.query(`SELECT (SELECT count(*) FROM refresh_tokens)::int AS tokens`);
    console.log(`[RefreshTokens] tokens: ${counts.tokens}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
