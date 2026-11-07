import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Private calendar subscription links (P5-05 part 2, CAL-07). Creates `calendar_feed_tokens`
 * (organisation, person, SHA-256 of the token, created, revoked, last used).
 *
 * A new empty table; no existing row changes. Safe to run twice; logs a count check.
 */
export class CalendarFeedTokens1756320000000 implements MigrationInterface {
  name = 'CalendarFeedTokens1756320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_feed_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_calendar_feed_tokens" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_calendar_feed_tokens_hash" ON "calendar_feed_tokens" ("token_hash")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_calendar_feed_tokens_user" ON "calendar_feed_tokens" ("organization_id", "user_id")`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_calendar_feed_tokens_user') THEN
          ALTER TABLE "calendar_feed_tokens" ADD CONSTRAINT "FK_calendar_feed_tokens_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    const [counts] = await queryRunner.query(`SELECT count(*)::int AS tokens FROM calendar_feed_tokens`);
    console.log(`[CalendarFeedTokens] tokens: ${counts.tokens}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_feed_tokens"`);
  }
}
